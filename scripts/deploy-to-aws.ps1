#!/usr/bin/env pwsh
# SmartOps - Deploy Local Code to AWS EKS
# Usage: .\deploy-to-aws.ps1 [-Service catalog-service] [-Tag buggy]

param(
  [string]$Service = "catalog-service",
  [string]$Tag     = "latest"
)

$ErrorActionPreference = "Stop"

$ECR_BASE  = "683444362809.dkr.ecr.ap-south-1.amazonaws.com"
$AWS_PROFILE = "sabari25"
$REGION    = "ap-south-1"
$NAMESPACE = "ammazone"

$SERVICE_PATHS = @{
  "api-gateway"     = "e-commerce-base\services\api-gateway"
  "catalog-service" = "e-commerce-base\services\catalog-service"
  "user-service"    = "e-commerce-base\services\user-service"
  "cart-service"    = "e-commerce-base\services\cart-service"
  "order-service"   = "e-commerce-base\services\order-service"
  "payment-service" = "e-commerce-base\services\payment-service"
  "frontend"        = "e-commerce-base\e-commerce-main"
}

$ROOT      = Split-Path -Parent $PSScriptRoot
$BUILD_CTX = Join-Path $ROOT $SERVICE_PATHS[$Service]
$IMAGE     = "$ECR_BASE/ammazone/${Service}:${Tag}"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploying: $Service -> $Tag" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. ECR login
Write-Host "[1/4] ECR auth..." -ForegroundColor Yellow
aws ecr get-login-password --region $REGION --profile $AWS_PROFILE |
    docker login --username AWS --password-stdin "$ECR_BASE" 2>&1 | Out-Null
Write-Host "  OK" -ForegroundColor Green

# 2. Build
Write-Host ""
Write-Host "[2/4] Building $Service..." -ForegroundColor Yellow
docker build -t $IMAGE $BUILD_CTX
Write-Host "  Built: $IMAGE" -ForegroundColor Green

# 3. Push
Write-Host ""
Write-Host "[3/4] Pushing to ECR..." -ForegroundColor Yellow
docker push $IMAGE
# NOTE: Only push as :latest when Tag IS "latest" — never overwrite :latest with a buggy tag
Write-Host "  Pushed" -ForegroundColor Green

# 4. Deploy
Write-Host ""
Write-Host "[4/4] Rolling out on EKS..." -ForegroundColor Yellow
aws eks update-kubeconfig --name ammazone-eks --region $REGION --profile $AWS_PROFILE 2>$null
kubectl set image deployment/$Service `
    $Service="$IMAGE" `
    --namespace $NAMESPACE
kubectl rollout status deployment/$Service --namespace $NAMESPACE --timeout=120s
Write-Host "  Deployed!" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  $Service is live as tag: $Tag" -ForegroundColor Green
Write-Host "  Shop: http://ae634db65cf544fc4a0f4f1293ff6488-0df386e6c4ce1f4d.elb.ap-south-1.amazonaws.com" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
