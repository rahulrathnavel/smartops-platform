$ErrorActionPreference = "Continue"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SMARTOPS FULL AUTONOMOUS DEPLOYMENT" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ROOT = "r:\zzz_last_smartops"

# 1. Terraform
Write-Host "`n[1/3] Finalizing Terraform Infrastructure..." -ForegroundColor Yellow
Set-Location "$ROOT\e-commerce-base\infrastructure\terraform"
terraform apply -auto-approve

# 2. Build All
Write-Host "`n[2/3] Building all Docker Images..." -ForegroundColor Yellow
Set-Location "$ROOT\scripts"
.\build-all.ps1

# 3. Demo Up
Write-Host "`n[3/3] Deploying to Kubernetes..." -ForegroundColor Yellow
Set-Location "$ROOT\scripts"
.\demo-up.ps1

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT FINISHED!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
