#!/usr/bin/env pwsh
# SmartOps Self-Healing Demo - Bug Injection Script
#
# STEP 1: The bug is already in products.js (uncomment the 4 lines).
#         If not, add this inside the GET / route after the sort block:
#
#   if (products[8]) {
#     const disc = products[8].price.getDiscount(); // TypeError: not a function
#     products[8].finalPrice = products[8].price - disc;
#   }
#
# STEP 2: git add .; git commit -m "feat: add dynamic pricing"; git push
#
# STEP 3: Run this script to build and deploy the buggy image

$ErrorActionPreference = "Stop"

$ECR_BASE  = "683444362809.dkr.ecr.ap-south-1.amazonaws.com"
$AWS_PROFILE = "sabari25"
$REGION    = "ap-south-1"
$SERVICE   = "catalog-service"
$TAG       = "buggy"
$NAMESPACE = "ammazone"
$BUILD_CTX = Join-Path $PSScriptRoot "..\e-commerce-base\services\catalog-service"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "  SmartOps Demo - Injecting Bug" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""

# 1. ECR login
Write-Host "[1/4] Authenticating to ECR..." -ForegroundColor Yellow
$ecrPwd = aws ecr get-login-password --region $REGION --profile $AWS_PROFILE
docker login --username AWS --password $ecrPwd "$ECR_BASE" 2>$null
Write-Host "  OK" -ForegroundColor Green

# 2. Build
Write-Host ""
Write-Host "[2/4] Building buggy image: $TAG" -ForegroundColor Yellow
docker build -t "$ECR_BASE/ammazone/${SERVICE}:${TAG}" $BUILD_CTX
Write-Host "  Build complete" -ForegroundColor Green

# 3. Push
Write-Host ""
Write-Host "[3/4] Pushing to ECR..." -ForegroundColor Yellow
docker push "$ECR_BASE/ammazone/${SERVICE}:${TAG}"
Write-Host "  Pushed $TAG" -ForegroundColor Green

# 4. Deploy
Write-Host ""
Write-Host "[4/4] Deploying buggy image to EKS..." -ForegroundColor Yellow
aws eks update-kubeconfig --name ammazone-eks --region $REGION --profile $AWS_PROFILE 2>$null
kubectl set image deployment/$SERVICE `
    $SERVICE="$ECR_BASE/ammazone/${SERVICE}:${TAG}" `
    --namespace $NAMESPACE
kubectl rollout restart deployment/$SERVICE --namespace $NAMESPACE
kubectl rollout status deployment/$SERVICE --namespace $NAMESPACE --timeout=90s
Write-Host "  Deployment complete" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "  BUG IS LIVE! Shop returns 500 now." -ForegroundColor Red
Write-Host "  SmartOps detects within 30 seconds." -ForegroundColor Yellow
Write-Host "  Watch Slack for the alert!" -ForegroundColor Cyan
Write-Host "  Dashboard: http://a838f4250b43e4d0489cd64ba2e22216-d3b0776ea4ad5d48.elb.ap-south-1.amazonaws.com" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""
