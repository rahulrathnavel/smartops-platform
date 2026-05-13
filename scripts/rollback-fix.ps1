#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# SmartOps Self-Healing Demo — Manual Rollback Script
# Run this to manually restore catalog-service if SmartOps auto-heal doesn't fire.
# ─────────────────────────────────────────────────────────────────────────────

$PROFILE    = "sabari25"
$REGION     = "ap-south-1"
$NAMESPACE  = "ammazone"
$DEPLOY     = "catalog-service"
$ECR_BASE   = "683444362809.dkr.ecr.ap-south-1.amazonaws.com"
$GOOD_TAG   = "latest"

Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  SmartOps Demo — Manual Recovery" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════`n" -ForegroundColor Green

aws eks update-kubeconfig --name ammazone-eks --region $REGION --profile $PROFILE 2>$null

# Option A: Rollback to previous revision
Write-Host "Rolling back $DEPLOY to previous good revision..." -ForegroundColor Yellow
kubectl rollout undo deployment/$DEPLOY --namespace $NAMESPACE
kubectl rollout status deployment/$DEPLOY --namespace $NAMESPACE --timeout=90s

Write-Host "`n✓ Recovery complete! Shop should be back online." -ForegroundColor Green
Write-Host "  E-Commerce: http://ae634db65cf544fc4a0f4f1293ff6488-0df386e6c4ce1f4d.elb.ap-south-1.amazonaws.com" -ForegroundColor Cyan
