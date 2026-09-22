#Requires -Version 5.1
<#
.SYNOPSIS
  Crea un usuario administrador en la base local de Supabase.
.EXAMPLE
  .\create-admin.ps1
  .\create-admin.ps1 -Email "admin@ejemplo.com" -Password $env:SIGIC_ADMIN_PASSWORD
#>

param(
  [string]$Email = "admin@sgic.local",
  [Parameter(Mandatory = $true)]
  [string]$Password,
  [string]$Name = "Administrador"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Crear Administrador Local ===" -ForegroundColor Cyan
Write-Host "  Email:    $Email" -ForegroundColor White

$publishableKey = $env:SUPABASE_PUBLISHABLE_KEY
if ([string]::IsNullOrWhiteSpace($publishableKey)) {
  throw "SUPABASE_PUBLISHABLE_KEY debe estar definida en el entorno y no debe almacenarse en el repositorio."
}

# 1. Sign up via Supabase Auth
Write-Host "`n[1/2] Creando usuario en Auth..." -ForegroundColor Yellow
$body = @{ email = $Email; password = $Password; data = @{ full_name = $Name } } | ConvertTo-Json
try {
  $result = Invoke-RestMethod -Uri "http://localhost:54321/auth/v1/signup" -Method POST -Body $body -ContentType "application/json" -Headers @{ apikey = $publishableKey }
  $userId = $result.user.id
  Write-Host "  Usuario creado: $userId" -ForegroundColor Green
} catch {
  Write-Host "  ERROR: $_" -ForegroundColor Red
  exit 1
}

# 2. Assign admin role
Write-Host "`n[2/2] Asignando rol admin..." -ForegroundColor Yellow
try {
  docker exec supabase_db_sgic-local psql -U postgres -d postgres -c "INSERT INTO public.user_roles (user_id, role) VALUES ('$userId', 'admin') ON CONFLICT DO NOTHING;" 2>$null
  Write-Host "  Rol admin asignado" -ForegroundColor Green
} catch {
  Write-Host "  AVISO: $_" -ForegroundColor Yellow
}

Write-Host "`n=== ADMIN CREADO ===" -ForegroundColor Cyan
Write-Host "  Email:    $Email" -ForegroundColor White
Write-Host "  Password: $Password" -ForegroundColor White
Write-Host "  Ingresa en http://localhost:8080" -ForegroundColor Green
