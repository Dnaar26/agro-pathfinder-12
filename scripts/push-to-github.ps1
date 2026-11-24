param(
  [string]$BranchName = "main",
  [string]$CommitMessage = "feat(ai-free-v3): add free multi-model cascade (gpt-oss-120b/20b + gemini-3.5-flash-lite), voice/photo chat, humidity fix and fast queries"
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

Write-Host "4. Confirmando y subiendo cambios a GitHub ($BranchName)..." -ForegroundColor Cyan
git add -A
git reset -- .env .env.local .env.production 2>$null

git commit -m $CommitMessage
git push -u origin $BranchName

Write-Host "Cambios validados y publicados en '$BranchName' exitosamente." -ForegroundColor Green
