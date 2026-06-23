# ActiveFit — Clean Dev Start
# Double-click or run: powershell -ExecutionPolicy Bypass -File start-dev.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ActiveFit  -  Starting Dev Servers    " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Kill ports ──────────────────────────────────────────────────────────
Write-Host "[1/4] Freeing ports 3000 and 3001..." -ForegroundColor Yellow
foreach ($port in @(3000, 3001)) {
  $lines = netstat -ano 2>$null | Select-String ":$port\s.*LISTEN"
  foreach ($line in $lines) {
    $p = ($line.ToString().Trim() -split '\s+')[-1]
    if ($p -match '^\d+$') {
      taskkill /PID $p /F 2>$null | Out-Null
      Write-Host "   Freed port $port" -ForegroundColor DarkGray
    }
  }
}
Start-Sleep -Milliseconds 800

# ── 2. Delete stale .next cache ────────────────────────────────────────────
Write-Host "[2/4] Deleting stale .next cache..." -ForegroundColor Yellow
$nextPath = "c:\Ajith\ActiveFit\frontend\.next"
if (Test-Path $nextPath) {
  Remove-Item -Recurse -Force $nextPath
  Write-Host "   .next deleted" -ForegroundColor DarkGray
} else {
  Write-Host "   .next already clean" -ForegroundColor DarkGray
}

# ── 3. Start Backend ───────────────────────────────────────────────────────
Write-Host "[3/4] Opening Backend terminal..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$host.ui.RawUI.WindowTitle='ActiveFit - API :3001'; " +
  "Write-Host '  ActiveFit Backend  ' -ForegroundColor Cyan -BackgroundColor DarkBlue; " +
  "Set-Location 'c:\Ajith\ActiveFit\backend'; " +
  "node dist/main.js"
)
Start-Sleep -Seconds 4

# ── 4. Start Frontend ──────────────────────────────────────────────────────
Write-Host "[4/4] Opening Frontend terminal (fresh compile)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$host.ui.RawUI.WindowTitle='ActiveFit - UI :3000'; " +
  "Write-Host '  ActiveFit Frontend  ' -ForegroundColor Cyan -BackgroundColor DarkBlue; " +
  "Set-Location 'c:\Ajith\ActiveFit\frontend'; " +
  "npm run dev"
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Both servers starting in new windows!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Wait ~15 seconds for first-time compile" -ForegroundColor Yellow
Write-Host ""
Write-Host "  BROWSER   ->  http://localhost:3000" -ForegroundColor White
Write-Host "  API       ->  http://localhost:3001/api/v1" -ForegroundColor White
Write-Host "  SWAGGER   ->  http://localhost:3001/api/docs" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: Do a HARD REFRESH in browser!" -ForegroundColor Red
Write-Host "  Chrome: Ctrl+Shift+R  |  Firefox: Ctrl+Shift+R" -ForegroundColor Red
Write-Host ""
Write-Host "  Demo login (Password: Password@123):" -ForegroundColor Yellow
Write-Host "    Super Admin  ->  superadmin@activeboost.com" -ForegroundColor Gray
Write-Host "    Gym Admin    ->  admin@fitnesshub.com" -ForegroundColor Gray
Write-Host "    Member       ->  user@example.com" -ForegroundColor Gray
Write-Host ""

# Open browser after 12s
Start-Sleep -Seconds 12
Start-Process "http://localhost:3000"
