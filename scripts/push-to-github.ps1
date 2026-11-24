param(
  [string]$BranchName = "feat/production-v2-streaming-trace-optimistic",
  [string]$CommitMessage = "feat(prod-v2): add AI SSE streaming, SQL public trace RPC, offline conflict tray, optimistic UI and real error telemetry"
)

$ErrorActionPreference = "Stop"

if (Test-Path "./agro-pathfinder-12-main") {
  Remove-Item -Recurse -Force "./agro-pathfinder-12-main"
}

Write-Host "1. Verificando dependencias sincronizadas (npm ci)..." -ForegroundColor Cyan
npm ci

Write-Host "2. Ejecutando typecheck, lint y pruebas unitarias..." -ForegroundColor Cyan
npm run typecheck
npm run lint
npm run test:e2e:safety
npm run test:phase34

Write-Host "3. Compilando build SSR de produccion..." -ForegroundColor Cyan
npm run build

Write-Host "4. Preparando rama Git segura sin exponer archivos .env..." -ForegroundColor Cyan
$branchExists = git branch --list $BranchName
if ($branchExists) {
  git checkout $BranchName
} else {
  git checkout -b $BranchName
}

git add -A
git reset -- .env .env.local .env.production 2>$null

git commit -m $CommitMessage
git push -u origin $BranchName

Write-Host "Rama '$BranchName' validada y publicada en GitHub." -ForegroundColor Green
