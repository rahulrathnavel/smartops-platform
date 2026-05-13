# ============================================================
# SmartOps Demo — Tear Down Script
# Destroys all resources to stop billing
# ============================================================

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot
$TF_DIR = "$ROOT\e-commerce-base\infrastructure\terraform"

Write-Host "`n========== SMARTOPS DEMO-DOWN ==========" -ForegroundColor Red

# --- Step 1: Uninstall Helm releases ---
Write-Host "`n[1/3] Uninstalling Helm releases..." -ForegroundColor Yellow
helm uninstall prometheus -n monitoring 2>$null

# --- Step 2: Delete K8s namespaces ---
Write-Host "`n[2/3] Deleting Kubernetes namespaces..." -ForegroundColor Yellow
kubectl delete namespace ammazone --timeout=60s 2>$null
kubectl delete namespace smartops-system --timeout=60s 2>$null
kubectl delete namespace monitoring --timeout=60s 2>$null

# --- Step 3: Terraform Destroy ---
Write-Host "`n[3/3] Destroying infrastructure (Terraform)..." -ForegroundColor Yellow
Push-Location $TF_DIR
terraform destroy -auto-approve
Pop-Location

Write-Host "`n========== TEARDOWN COMPLETE ==========" -ForegroundColor Green
Write-Host "All resources destroyed. No further billing." -ForegroundColor Cyan
