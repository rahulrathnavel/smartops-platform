#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────
# ammazone - Teardown Script
# Destroys ALL infrastructure to stop billing immediately
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$env:Path = "$env:Path;C:\terraform;C:\helm;C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"

$ROOT = Split-Path -Parent $PSScriptRoot
$TF_DIR = "$ROOT\infrastructure\terraform"

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "  ammazone TEARDOWN" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host "This will DESTROY all cloud resources.`n" -ForegroundColor Yellow

$confirm = Read-Host "Type 'destroy' to confirm"
if ($confirm -ne "destroy") {
  Write-Host "Aborted." -ForegroundColor Yellow
  exit 0
}

# Delete K8s resources first (removes ALB)
Write-Host "`n[1/3] Deleting K8s resources..." -ForegroundColor Yellow
try {
  kubectl delete ingress ammazone-ingress -n ammazone 2>$null
  Start-Sleep -Seconds 30  # Wait for ALB to be deleted
  kubectl delete namespace ammazone 2>$null
  helm uninstall aws-load-balancer-controller -n kube-system 2>$null
  Write-Host "  ✓ K8s resources deleted" -ForegroundColor Green
} catch {
  Write-Host "  ⚠ Some K8s resources may not exist" -ForegroundColor Yellow
}

# Terraform destroy
Write-Host "`n[2/3] Running terraform destroy..." -ForegroundColor Yellow
Push-Location $TF_DIR
terraform destroy -auto-approve
Pop-Location
Write-Host "  ✓ All cloud resources destroyed" -ForegroundColor Green

# Clean up local Docker images
Write-Host "`n[3/3] Cleaning local Docker images..." -ForegroundColor Yellow
docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -like "*ammazone*" } | ForEach-Object { docker rmi $_ 2>$null }
Write-Host "  ✓ Local cleanup done" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Teardown Complete - Billing Stopped" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
