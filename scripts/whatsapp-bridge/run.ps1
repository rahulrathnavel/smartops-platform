#!/usr/bin/env pwsh
# SmartOps WhatsApp Bridge — setup and run
# Run this ONCE to install dependencies and start the bridge.
# After the first QR scan, the session is saved and future runs start without scanning.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SmartOps WhatsApp Bridge" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Install dependencies if needed
if (-not (Test-Path "$ScriptDir\node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    Set-Location $ScriptDir
    npm install
    Write-Host "Done." -ForegroundColor Green
    Write-Host ""
}

Write-Host "Starting bridge..." -ForegroundColor Yellow
Write-Host "  1. A QR code will appear below (first run only)" -ForegroundColor Gray
Write-Host "  2. Open WhatsApp on your phone" -ForegroundColor Gray
Write-Host "  3. Go to Settings > Linked Devices > Link a Device" -ForegroundColor Gray
Write-Host "  4. Scan the QR code" -ForegroundColor Gray
Write-Host "  5. Create a WhatsApp group named: SmartOps Incidents" -ForegroundColor Gray
Write-Host "  6. The bridge sends incident alerts to that group" -ForegroundColor Gray
Write-Host ""
Write-Host "Reply options in WhatsApp:" -ForegroundColor Cyan
Write-Host "  1             -> Approve and Deploy" -ForegroundColor White
Write-Host "  2             -> Reject" -ForegroundColor White
Write-Host "  3 <your text> -> Suggest a change to the fix" -ForegroundColor White
Write-Host ""

Set-Location $ScriptDir
node index.js
