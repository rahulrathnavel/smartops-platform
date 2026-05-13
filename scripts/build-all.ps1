# ============================================================
# SmartOps — Build & Push All Docker Images
# Run this BEFORE demo-up.ps1
# Estimated time: ~15 minutes
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$ECR = "683444362809.dkr.ecr.ap-south-1.amazonaws.com"
$REGION = "ap-south-1"
$PROFILE = "praveen"

Write-Host "`n========== BUILD ALL IMAGES ==========" -ForegroundColor Cyan

# --- ECR Login ---
Write-Host "`n[0] Logging into ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $REGION --profile $PROFILE | docker login --username AWS --password-stdin $ECR

# --- E-Commerce Services ---
$services = @(
  @{ Name="api-gateway";     Path="$ROOT\e-commerce-base\services\api-gateway";     Tag="ammazone/api-gateway:latest" },
  @{ Name="user-service";    Path="$ROOT\e-commerce-base\services\user-service";    Tag="ammazone/user-service:latest" },
  @{ Name="catalog-service"; Path="$ROOT\e-commerce-base\services\catalog-service"; Tag="ammazone/catalog-service:latest" },
  @{ Name="cart-service";    Path="$ROOT\e-commerce-base\services\cart-service";    Tag="ammazone/cart-service:latest" },
  @{ Name="payment-service"; Path="$ROOT\e-commerce-base\services\payment-service"; Tag="ammazone/payment-service:latest" },
  @{ Name="order-service";   Path="$ROOT\e-commerce-base\services\order-service";   Tag="ammazone/order-service:latest" },
  @{ Name="frontend";        Path="$ROOT\e-commerce-base\e-commerce-main";          Tag="ammazone/frontend:latest" }
)

$step = 1
foreach ($svc in $services) {
  Write-Host "`n[$step/${services.Count + 3}] Building $($svc.Name)..." -ForegroundColor Yellow

  # Copy shared metrics module into each service's build context (except frontend)
  if ($svc.Name -ne "frontend") {
    $sharedDest = Join-Path $svc.Path "shared"
    if (!(Test-Path $sharedDest)) { New-Item -ItemType Directory -Path $sharedDest -Force | Out-Null }
    Copy-Item "$ROOT\e-commerce-base\services\shared\metrics.js" "$sharedDest\metrics.js" -Force

    # Install prom-client if not in package.json
    $pkgJson = Get-Content (Join-Path $svc.Path "package.json") -Raw
    if ($pkgJson -notmatch 'prom-client') {
      Push-Location $svc.Path
      npm install prom-client@latest --save 2>$null
      Pop-Location
    }
  }

  docker build --no-cache -t "$ECR/$($svc.Tag)" $svc.Path
  docker push "$ECR/$($svc.Tag)"
  $step++
}

# --- SmartOps Agent ---
Write-Host "`n[$step] Building smartops-agent..." -ForegroundColor Yellow
Push-Location "$ROOT\smartops-agent"
npm install 2>$null
Pop-Location
docker build --no-cache -t "$ECR/ammazone/smartops-agent:v5" "$ROOT\smartops-agent"
docker push "$ECR/ammazone/smartops-agent:v5"
$step++

# --- Dashboard Backend ---
Write-Host "`n[$step] Building dashboard-backend..." -ForegroundColor Yellow
Push-Location "$ROOT\dashboard\dashboard-aws-main\smartops-backend"
npm install 2>$null
Pop-Location
docker build --no-cache -t "$ECR/ammazone/smartops-dashboard-backend:latest" "$ROOT\dashboard\dashboard-aws-main\smartops-backend"
docker push "$ECR/ammazone/smartops-dashboard-backend:latest"
$step++

# --- Dashboard Frontend ---
Write-Host "`n[$step] Building dashboard-frontend..." -ForegroundColor Yellow
Push-Location "$ROOT\dashboard\dashboard-aws-main\smartops-frontend"
npm install 2>$null
Pop-Location
docker build --no-cache -t "$ECR/ammazone/smartops-dashboard-frontend:latest" "$ROOT\dashboard\dashboard-aws-main\smartops-frontend"
docker push "$ECR/ammazone/smartops-dashboard-frontend:latest"

Write-Host "`n========== ALL IMAGES BUILT & PUSHED ==========" -ForegroundColor Green
Write-Host "Now run: scripts\demo-up.ps1" -ForegroundColor Cyan
