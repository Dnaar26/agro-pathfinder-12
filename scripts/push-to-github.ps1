param(
  [string]$BranchName = "main",
  [string]$CommitMessage = "feat(v12): add multi-worker crew payroll sheet, CSV loader, batch settlement, and printable PDF vouchers with signature column"
)

$ErrorActionPreference = "Stop"

if (Test-Path "./agro-pathfinder-12-main") {
  Remove-Item -Recurse -Force "./agro-pathfinder-12-main"
}

Write-Host "1. Verificando dependencias sincronizadas (npm.cmd ci)..." -ForegroundColor Cyan
npm.cmd ci

Write-Host "2. Ejecutando typecheck, lint y pruebas unitarias..." -ForegroundColor Cyan
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:e2e:safety
npm.cmd run test:phase34

Write-Host "3. Compilando build SSR de produccion..." -ForegroundColor Cyan
npm.cmd run build

Write-Host "4. Confirmando y subiendo cambios a GitHub ($BranchName)..." -ForegroundColor Cyan
if (-not (Test-Path "./.git")) {
  git init -b $BranchName
  git remote add origin https://github.com/Dnaar26/agro-pathfinder-12.git
  git fetch origin $BranchName
  git reset --soft "origin/$BranchName"
}

git add -A
if (Test-Path ".env") { git reset -- .env }
if (Test-Path ".env.local") { git reset -- .env.local }
if (Test-Path ".env.production") { git reset -- .env.production }

git commit -m $CommitMessage
git push -u origin $BranchName

Write-Host "Version v12 validada y publicada en '$BranchName' exitosamente." -ForegroundColor Green
