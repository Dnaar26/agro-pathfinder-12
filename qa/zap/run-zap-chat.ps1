$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "$PSScriptRoot/reports" | Out-Null

Write-Host "Ejecutando auditoria DAST con OWASP ZAP sobre http://host.docker.internal:8080/chat ..." -ForegroundColor Cyan

docker run --rm -t `
  -v "${PSScriptRoot}:/zap/wrk/:rw" `
  ghcr.io/zaproxy/zaproxy:stable `
  zap.sh -cmd -autorun /zap/wrk/zap-chat-automation.yaml

Write-Host "Reporte generado en qa/zap/reports/zap-sigic-chat-report.html" -ForegroundColor Green
