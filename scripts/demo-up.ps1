# ============================================================
# SmartOps Demo - Spin Up Script
# Provisions infrastructure, deploys all services, prints URLs
# ============================================================

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot
$TF_DIR = "$ROOT\e-commerce-base\infrastructure\terraform"
$K8S_DIR = "$ROOT\e-commerce-base\k8s"
$DASH_DIR = "$ROOT\dashboard\dashboard-aws-main"
$AGENT_DIR = "$ROOT\smartops-agent"
$ECR = "683444362809.dkr.ecr.ap-south-1.amazonaws.com/ammazone"
$REGION = "ap-south-1"
$PROFILE = "sabari25"

Write-Host "`n========== SMARTOPS DEMO-UP ==========" -ForegroundColor Cyan

# --- Step 1: Terraform Apply ---
Write-Host "`n[1/7] Provisioning infrastructure (Terraform)..." -ForegroundColor Yellow
Push-Location $TF_DIR
terraform init -input=false
terraform apply -auto-approve
Pop-Location

# --- Step 2: Configure kubectl ---
Write-Host "`n[2/7] Configuring kubectl..." -ForegroundColor Yellow
aws eks update-kubeconfig --region $REGION --name ammazone-eks --profile $PROFILE

# --- Step 3: Enable VPC CNI Prefix Delegation ---
# t3.micro only supports 4 pods/node by default (ENI limit).
# Prefix delegation removes this limit, allowing 110+ pods/node.
Write-Host "`n[3/7] Enabling VPC CNI prefix delegation (critical for t3.micro)..." -ForegroundColor Yellow
kubectl set env daemonset aws-node -n kube-system ENABLE_PREFIX_DELEGATION=true
kubectl set env daemonset aws-node -n kube-system WARM_PREFIX_TARGET=1
# Wait for aws-node daemonset to restart with new config
Write-Host "  Waiting 30s for VPC CNI to reconfigure..." -ForegroundColor Gray
Start-Sleep -Seconds 30
# Rollout restart to pick up changes
kubectl rollout restart daemonset aws-node -n kube-system
kubectl rollout status daemonset aws-node -n kube-system --timeout=120s 2>$null
Write-Host "  VPC CNI prefix delegation enabled." -ForegroundColor Green

# --- Step 4: Deploy base infrastructure ---
Write-Host "`n[4/7] Deploying K8s infrastructure..." -ForegroundColor Yellow
kubectl apply -f "$K8S_DIR\namespace.yaml"
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace smartops-system --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$K8S_DIR\secrets.local.yaml"
kubectl apply -f "$K8S_DIR\configmap.yaml"
kubectl apply -f "$K8S_DIR\infra\redis.yaml"
kubectl apply -f "$K8S_DIR\infra\rabbitmq.yaml"

# --- Step 5: Deploy Prometheus ---
Write-Host "`n[5/7] Installing Prometheus via Helm..." -ForegroundColor Yellow
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>$null
helm repo update 2>$null

# Try helm install with extended timeout; if it fails, continue anyway
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack --namespace monitoring --values "$K8S_DIR\infra\prometheus-values.yaml" --wait --timeout 8m 2>$null

if ($LASTEXITCODE -ne 0) {
  Write-Host "  Helm install had issues - Prometheus may need time to stabilize." -ForegroundColor Yellow
} else {
  Write-Host "  Prometheus installed successfully." -ForegroundColor Green
}

# --- Step 6: Deploy all services ---
Write-Host "`n[6/7] Deploying microservices + dashboard..." -ForegroundColor Yellow
Get-ChildItem "$K8S_DIR\services\*.yaml" | ForEach-Object {
  kubectl apply -f $_.FullName
}
# SmartOps Agent
Get-ChildItem "$AGENT_DIR\infrastructure\k8s\*.yaml" -ErrorAction SilentlyContinue | ForEach-Object {
  kubectl apply -f $_.FullName
}
# Dashboard
kubectl apply -f "$DASH_DIR\k8s\dashboard.yaml"

# --- Step 7: Wait and print URLs ---
Write-Host "`n[7/7] Waiting for pods to be ready (up to 5 min)..." -ForegroundColor Yellow
$namespaces = @("ammazone", "smartops-system")
foreach ($ns in $namespaces) {
  Write-Host "  Waiting for $ns pods..." -ForegroundColor Gray
  kubectl wait --for=condition=Ready pods --all -n $ns --timeout=300s 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: Some pods in $ns may not be ready yet." -ForegroundColor Yellow
    kubectl get pods -n $ns
  }
}

Write-Host "`n========== DEPLOYMENT COMPLETE ==========" -ForegroundColor Green

Write-Host "`nPod Status:" -ForegroundColor Cyan
kubectl get pods -A --no-headers | Select-String -Pattern "ammazone|smartops|monitoring"

Write-Host "`nNode Info:" -ForegroundColor Cyan
kubectl get nodes -o wide

Write-Host "`nPublic URLs (may take 2-3 min for DNS to propagate):" -ForegroundColor Cyan
$frontendLB = kubectl get svc frontend-lb -n ammazone -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null
$dashboardLB = kubectl get svc dashboard-frontend -n smartops-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null
$agentLB = kubectl get svc smartops-agent-lb -n smartops-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null

Write-Host "  E-Commerce:  http://$frontendLB" -ForegroundColor White
Write-Host "  Dashboard:   http://$dashboardLB" -ForegroundColor White
Write-Host "  Agent (WS):  http://$agentLB" -ForegroundColor White

Write-Host "`nSlack Interaction URL (paste in Slack App settings):" -ForegroundColor Yellow
Write-Host "  http://${agentLB}/slack/interactions" -ForegroundColor White
Write-Host "`nDone! Run scripts\demo-down.ps1 to tear down." -ForegroundColor Cyan
