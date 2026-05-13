#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────
# ammazone - Full Deploy Script
# Builds Docker images, pushes to ECR, populates K8s secrets,
# and deploys everything to EKS.
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$env:Path = "$env:Path;C:\terraform;C:\helm;C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"

$ROOT = Split-Path -Parent $PSScriptRoot  # r:\zzz_last_smartops\e-commerce-base
$TF_DIR = "$ROOT\infrastructure\terraform"
$K8S_DIR = "$ROOT\k8s"
$SERVICES_DIR = "$ROOT\services"
$FRONTEND_DIR = "$ROOT\e-commerce-main"

$AWS_PROFILE = "praveen"
$AWS_REGION = "ap-south-1"
$AWS_ACCOUNT_ID = "295284356306"
$ECR_BASE = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ammazone Deployment Pipeline" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ─────── Step 1: Extract Terraform Outputs ───────
Write-Host "[1/8] Extracting Terraform outputs..." -ForegroundColor Yellow
Push-Location $TF_DIR

$EKS_CLUSTER = (terraform output -raw eks_cluster_name 2>$null)
$COSMOS_CONN = (terraform output -raw cosmosdb_connection_string 2>$null)
$COSMOS_USERS_DB = (terraform output -raw cosmosdb_users_db 2>$null)
$COSMOS_CATALOG_DB = (terraform output -raw cosmosdb_catalog_db 2>$null)
$COSMOS_ORDERS_DB = (terraform output -raw cosmosdb_orders_db 2>$null)
$APPINSIGHTS_CONN = (terraform output -raw appinsights_connection_string 2>$null)
$DYNAMODB_TABLE = (terraform output -raw dynamodb_table_name 2>$null)

Pop-Location

# Parse Cosmos connection string and build per-database URIs
# Format: mongodb://account:key@host:port/?ssl=true...
$COSMOS_USERS_URI = $COSMOS_CONN -replace '\?', "/$COSMOS_USERS_DB`?"
$COSMOS_CATALOG_URI = $COSMOS_CONN -replace '\?', "/$COSMOS_CATALOG_DB`?"
$COSMOS_ORDERS_URI = $COSMOS_CONN -replace '\?', "/$COSMOS_ORDERS_DB`?"

Write-Host "  EKS Cluster: $EKS_CLUSTER" -ForegroundColor Green
Write-Host "  DynamoDB Table: $DYNAMODB_TABLE" -ForegroundColor Green
Write-Host "  Cosmos Databases: $COSMOS_USERS_DB, $COSMOS_CATALOG_DB, $COSMOS_ORDERS_DB" -ForegroundColor Green

# ─────── Step 2: Configure kubectl ───────
Write-Host "`n[2/8] Configuring kubectl for EKS..." -ForegroundColor Yellow
aws eks update-kubeconfig --name $EKS_CLUSTER --region $AWS_REGION --profile $AWS_PROFILE
Write-Host "  kubectl configured" -ForegroundColor Green

# ─────── Step 3: ECR Login ───────
Write-Host "`n[3/8] Logging in to ECR..." -ForegroundColor Yellow
$ECR_TOKEN = aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE
docker login --username AWS --password $ECR_TOKEN "$ECR_BASE" 2>$null
Write-Host "  ECR login successful" -ForegroundColor Green

# ─────── Step 4: Build & Push Docker images ───────
Write-Host "`n[4/8] Building & pushing Docker images..." -ForegroundColor Yellow

$services = @(
  @{ name = "api-gateway";     path = "$SERVICES_DIR\api-gateway" },
  @{ name = "user-service";    path = "$SERVICES_DIR\user-service" },
  @{ name = "catalog-service"; path = "$SERVICES_DIR\catalog-service" },
  @{ name = "cart-service";    path = "$SERVICES_DIR\cart-service" },
  @{ name = "payment-service"; path = "$SERVICES_DIR\payment-service" },
  @{ name = "order-service";   path = "$SERVICES_DIR\order-service" },
  @{ name = "frontend";        path = $FRONTEND_DIR }
)

foreach ($svc in $services) {
  $img = "$ECR_BASE/ammazone/$($svc.name):latest"
  Write-Host "  Building $($svc.name)..." -ForegroundColor Gray
  docker build -t $img $svc.path
  Write-Host "  Pushing $($svc.name)..." -ForegroundColor Gray
  docker push $img
  Write-Host "  ✓ $($svc.name)" -ForegroundColor Green
}

# ─────── Step 5: Apply K8s Namespace + ConfigMap ───────
Write-Host "`n[5/8] Applying K8s base resources..." -ForegroundColor Yellow
kubectl apply -f "$K8S_DIR\namespace.yaml"
kubectl apply -f "$K8S_DIR\configmap.yaml"
Write-Host "  ✓ Namespace + ConfigMap" -ForegroundColor Green

# ─────── Step 6: Populate & Apply Secrets ───────
Write-Host "`n[6/8] Populating K8s secrets..." -ForegroundColor Yellow
$JWT_SECRET = [System.Guid]::NewGuid().ToString() + "-" + [System.Guid]::NewGuid().ToString()

# Create secrets directly via kubectl (avoids writing to disk)
kubectl create secret generic ammazone-secrets `
  --namespace ammazone `
  --from-literal="JWT_SECRET=$JWT_SECRET" `
  --from-literal="COSMOS_USERS_URI=$COSMOS_USERS_URI" `
  --from-literal="COSMOS_CATALOG_URI=$COSMOS_CATALOG_URI" `
  --from-literal="COSMOS_ORDERS_URI=$COSMOS_ORDERS_URI" `
  --from-literal="APPINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONN" `
  --dry-run=client -o yaml | kubectl apply -f -

Write-Host "  ✓ Secrets populated" -ForegroundColor Green

# ─────── Step 7: Deploy infrastructure + services ───────
Write-Host "`n[7/8] Deploying workloads to EKS..." -ForegroundColor Yellow

# Infrastructure first
kubectl apply -f "$K8S_DIR\infra\redis.yaml"
kubectl apply -f "$K8S_DIR\infra\rabbitmq.yaml"
kubectl apply -f "$K8S_DIR\infra\otel-collector.yaml"
Write-Host "  ✓ Redis, RabbitMQ, OTel Collector" -ForegroundColor Green

# Update service manifests with real ECR URLs
$serviceFiles = Get-ChildItem "$K8S_DIR\services\*.yaml"
foreach ($f in $serviceFiles) {
  $content = Get-Content $f -Raw
  $content = $content -replace 'PLACEHOLDER_ECR_URL', "$ECR_BASE/ammazone"
  $content | kubectl apply -f -
}
Write-Host "  ✓ All services deployed" -ForegroundColor Green

# ─────── Step 8: Install ALB Ingress Controller + Apply Ingress ───────
Write-Host "`n[8/8] Installing AWS Load Balancer Controller..." -ForegroundColor Yellow

# Add Helm repo
helm repo add eks https://aws.github.io/eks-charts 2>$null
helm repo update 2>$null

# Install ALB controller
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller `
  --namespace kube-system `
  --set clusterName=$EKS_CLUSTER `
  --set serviceAccount.create=true `
  --set serviceAccount.name=aws-load-balancer-controller `
  --set region=$AWS_REGION `
  --set vpcId=(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=ammazone-vpc" --query "Vpcs[0].VpcId" --output text --profile $AWS_PROFILE --region $AWS_REGION)

Start-Sleep -Seconds 10

# Apply Ingress
kubectl apply -f "$K8S_DIR\ingress.yaml"
Write-Host "  ✓ ALB Ingress Controller + Ingress applied" -ForegroundColor Green

# ─────── Seed Catalog ───────
Write-Host "`n[BONUS] Seeding catalog data..." -ForegroundColor Yellow
$CATALOG_POD = kubectl get pods -n ammazone -l app=catalog-service -o jsonpath='{.items[0].metadata.name}' 2>$null
if ($CATALOG_POD) {
  kubectl exec -n ammazone $CATALOG_POD -- node src/seed/seed.js
  Write-Host "  ✓ Catalog seeded" -ForegroundColor Green
} else {
  Write-Host "  ⚠ Catalog pod not ready yet, seed manually later" -ForegroundColor Yellow
}

# ─────── Final Status ───────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
kubectl get pods -n ammazone -o wide
Write-Host ""

# Get ALB URL
Start-Sleep -Seconds 15
$ALB_URL = kubectl get ingress -n ammazone ammazone-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null
if ($ALB_URL) {
  Write-Host "  PUBLIC URL: http://$ALB_URL" -ForegroundColor Green
} else {
  Write-Host "  ALB provisioning... run this to check:" -ForegroundColor Yellow
  Write-Host "  kubectl get ingress -n ammazone" -ForegroundColor Gray
}
