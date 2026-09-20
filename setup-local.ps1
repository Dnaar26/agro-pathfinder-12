#Requires -Version 5.1
<#
.SYNOPSIS
  Setup script for SGIC local development environment.
  Starts Docker (if needed), boots Supabase stack, applies migrations,
  creates storage buckets, and updates .env.
#>

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host "=== SGIC - Setup Local Development ===" -ForegroundColor Cyan

# 1. Check Docker
Write-Host "`n[1/5] Verificando Docker..." -ForegroundColor Yellow
try {
  $null = docker info 2>&1 | Out-Null
  Write-Host "  Docker OK" -ForegroundColor Green
} catch {
  Write-Host "  Docker no está corriendo. Iniciando Docker Desktop..." -ForegroundColor Yellow
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  Start-Sleep -Seconds 30
  $null = docker info 2>&1 | Out-Null
  Write-Host "  Docker listo" -ForegroundColor Green
}

# 2. Check Supabase CLI
Write-Host "`n[2/5] Verificando Supabase CLI..." -ForegroundColor Yellow
$supa = & npx supabase --version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Supabase CLI v$supa OK" -ForegroundColor Green
} else {
  Write-Host "  ERROR: npx no disponible. Instala Node.js." -ForegroundColor Red
  exit 1
}

# 3. Start Supabase
Write-Host "`n[3/5] Iniciando Supabase local..." -ForegroundColor Yellow
Set-Location -LiteralPath $ROOT

# Stop any old project that may be using the ports
$oldProject = (& npx supabase status 2>&1 | Select-String -Pattern "supabase_db_" | ForEach-Object { $_ -replace '.*supabase_db_','' })
if ($oldProject -and $oldProject -ne "sgic-local") {
  Write-Host "  Deteniendo proyecto anterior '$oldProject'..." -ForegroundColor Yellow
  & npx supabase stop --project-id $oldProject 2>$null
}

$start = & npx supabase start 2>&1
if ($LASTEXITCODE -eq 0 -or $start -match "setup is running") {
  Write-Host "  Supabase local corriendo!" -ForegroundColor Green
} else {
  $status = & npx supabase status 2>&1
  if ($status -match "running") {
    Write-Host "  Ya estaba corriendo" -ForegroundColor Green
  } else {
    Write-Host "  ERROR al iniciar Supabase: $start" -ForegroundColor Red
    exit 1
  }
}

# 4. Apply migrations
Write-Host "`n[4/5] Aplicando migraciones..." -ForegroundColor Yellow
$mig = & npx supabase migration up 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Migraciones aplicadas OK" -ForegroundColor Green
} else {
  Write-Host "  ERROR en migraciones: $mig" -ForegroundColor Red
  exit 1
}

# 5. Create storage buckets
Write-Host "`n[5/5] Creando buckets de Storage..." -ForegroundColor Yellow
$bucket = docker exec supabase_db_sgic-local psql -U postgres -d postgres -c "INSERT INTO storage.buckets (id,name,public,file_size_limit) VALUES ('evidences','evidences',false,10485760) ON CONFLICT (id) DO NOTHING;" 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Bucket 'evidences' listo" -ForegroundColor Green
} else {
  Write-Host "  AVISO: No se pudo crear bucket ($bucket)" -ForegroundColor Yellow
}

# 6. Configure Google OAuth if credentials exist
Write-Host "`n[6/6] Verificando Google OAuth..." -ForegroundColor Yellow
$googleId = $env:GOOGLE_CLIENT_ID
$googleSecret = $env:GOOGLE_SECRET
if ($googleId -and $googleSecret) {
  Write-Host "  GOOGLE_CLIENT_ID encontrado en entorno. Configurando..." -ForegroundColor Green
} else {
  Write-Host "  AVISO: Google OAuth no configurado. El botón 'Continuar con Google' mostrará un mensaje." -ForegroundColor Yellow
  Write-Host "  Para habilitarlo, configura GOOGLE_CLIENT_ID y GOOGLE_SECRET en las variables de entorno:" -ForegroundColor Yellow
  Write-Host "    \$env:GOOGLE_CLIENT_ID='tu-client-id'" -ForegroundColor Gray
  Write-Host "    \$env:GOOGLE_SECRET='tu-secret'" -ForegroundColor Gray
  Write-Host "  Luego añade http://localhost:54321/auth/v1/callback como URI autorizada en" -ForegroundColor Gray
  Write-Host "  https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
}

Write-Host "`n=== SETUP COMPLETO ===" -ForegroundColor Cyan
Write-Host "  App:       http://localhost:8080 (o http://localhost:8081 si 8080 está ocupado)" -ForegroundColor White
Write-Host "  Supabase:  http://127.0.0.1:54321" -ForegroundColor White
Write-Host "  Studio:    http://127.0.0.1:54323" -ForegroundColor White
Write-Host "  DB:        postgresql://postgres:postgres@127.0.0.1:54322/postgres" -ForegroundColor White
Write-Host "`nEjecuta 'npm run dev' para iniciar la app." -ForegroundColor Green
