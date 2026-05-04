# Port Migration Script for Friendly AIAEP (PowerShell)
# Updates all ports from old allocation to new allocation
# UI Apps: 6000+, APIs/DBs/Services: 7500+

param(
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Friendly AIAEP Port Migration Script" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "This script will update all port allocations to the new scheme:"
Write-Host "  - UI Applications: 6000-6999" -ForegroundColor Yellow
Write-Host "  - APIs/DBs/Services: 7500-8999" -ForegroundColor Yellow
Write-Host ""
Write-Host "Project root: $ProjectRoot"
if ($DryRun) {
    Write-Host "DRY RUN MODE - No files will be modified" -ForegroundColor Magenta
}
Write-Host ""

function Backup-File {
    param([string]$FilePath)

    if (Test-Path $FilePath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupPath = "$FilePath.bak-$timestamp"
        Copy-Item $FilePath $backupPath
        Write-Host "  ✓ Backed up: $FilePath" -ForegroundColor Green
    }
}

function Replace-Ports {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        Write-Host "  ⚠ File not found: $FilePath" -ForegroundColor Yellow
        return
    }

    if (-not $DryRun) {
        Backup-File $FilePath
    }

    $content = Get-Content $FilePath -Raw

    # UI Ports (6000-6999)
    $content = $content -replace "'4200:4200'", "'6000:4200'"
    $content = $content -replace "- '4200:4200'", "- '6000:4200'"
    $content = $content -replace "'3000:3000'", "'6001:3000'"
    $content = $content -replace "- '3000:3000'", "- '6001:3000'"
    $content = $content -replace "'16686:16686'", "'6002:16686'"
    $content = $content -replace "- '16686:16686'", "- '6002:16686'"
    $content = $content -replace "'9001:9001'", "'6003:9001'"
    $content = $content -replace "- '9001:9001'", "- '6003:9001'"
    $content = $content -replace "'5050:80'", "'6004:80'"
    $content = $content -replace "- '5050:80'", "- '6004:80'"
    $content = $content -replace "'4873:4873'", "'6005:4873'"
    $content = $content -replace "- '4873:4873'", "- '6005:4873'"

    # API Ports (7500-7599)
    $content = $content -replace "'3001:3001'", "'7500:3001'"
    $content = $content -replace "- '3001:3001'", "- '7500:3001'"
    $content = $content -replace "'3002:3002'", "'7501:3002'"
    $content = $content -replace "- '3002:3002'", "- '7501:3002'"
    $content = $content -replace "'3003:3003'", "'7502:3003'"
    $content = $content -replace "- '3003:3003'", "- '7502:3003'"

    # Database Ports (7600-7649)
    $content = $content -replace "'5432:5432'", "'7600:5432'"
    $content = $content -replace "- '5432:5432'", "- '7600:5432'"
    $content = $content -replace "'8086:8086'", "'7601:8086'"
    $content = $content -replace "- '8086:8086'", "- '7601:8086'"
    $content = $content -replace "'6379:6379'", "'7602:6379'"
    $content = $content -replace "- '6379:6379'", "- '7602:6379'"

    # Object Storage (7650-7669)
    $content = $content -replace "'9000:9000'", "'7650:9000'"
    $content = $content -replace "- '9000:9000'", "- '7650:9000'"

    # Metrics Collection (7700-7749)
    $content = $content -replace "'9090:9090'", "'7700:9090'"
    $content = $content -replace "- '9090:9090'", "- '7700:9090'"
    $content = $content -replace "'9100:9100'", "'7701:9100'"
    $content = $content -replace "- '9100:9100'", "- '7701:9100'"
    $content = $content -replace "'9121:9121'", "'7702:9121'"
    $content = $content -replace "- '9121:9121'", "- '7702:9121'"
    $content = $content -replace "'9187:9187'", "'7703:9187'"
    $content = $content -replace "- '9187:9187'", "- '7703:9187'"

    # Logs (7750-7769)
    $content = $content -replace "'3100:3100'", "'7750:3100'"
    $content = $content -replace "- '3100:3100'", "- '7750:3100'"
    $content = $content -replace "'9080:9080'", "'7751:9080'"
    $content = $content -replace "- '9080:9080'", "- '7751:9080'"

    # Tracing (7770-7799)
    $content = $content -replace "'5775:5775/udp'", "'7770:5775/udp'"
    $content = $content -replace "- '5775:5775/udp'", "- '7770:5775/udp'"
    $content = $content -replace "'5778:5778'", "'7771:5778'"
    $content = $content -replace "- '5778:5778'", "- '7771:5778'"
    $content = $content -replace "'6831:6831/udp'", "'7772:6831/udp'"
    $content = $content -replace "- '6831:6831/udp'", "- '7772:6831/udp'"
    $content = $content -replace "'6832:6832/udp'", "'7773:6832/udp'"
    $content = $content -replace "- '6832:6832/udp'", "- '7773:6832/udp'"
    $content = $content -replace "'14250:14250'", "'7774:14250'"
    $content = $content -replace "- '14250:14250'", "- '7774:14250'"
    $content = $content -replace "'14268:14268'", "'7775:14268'"
    $content = $content -replace "- '14268:14268'", "- '7775:14268'"
    $content = $content -replace "'14269:14269'", "'7776:14269'"
    $content = $content -replace "- '14269:14269'", "- '7776:14269'"

    # OpenTelemetry (7800-7819)
    $content = $content -replace "'4317:4317'", "'7800:4317'"
    $content = $content -replace "- '4317:4317'", "- '7800:4317'"
    $content = $content -replace "'4318:4318'", "'7801:4318'"
    $content = $content -replace "- '4318:4318'", "- '7801:4318'"

    # Data Ingestion (7820-7849)
    $content = $content -replace "'8094:8094'", "'7820:8094'"
    $content = $content -replace "- '8094:8094'", "- '7820:8094'"
    $content = $content -replace "'8092:8092/udp'", "'7821:8092/udp'"
    $content = $content -replace "- '8092:8092/udp'", "- '7821:8092/udp'"
    $content = $content -replace "'8125:8125/udp'", "'7822:8125/udp'"
    $content = $content -replace "- '8125:8125/udp'", "- '7822:8125/udp'"

    if (-not $DryRun) {
        Set-Content -Path $FilePath -Value $content -NoNewline
    }

    Write-Host "  ✓ Updated: $FilePath" -ForegroundColor Green
}

function Update-EnvironmentFile {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return
    }

    if (-not $DryRun) {
        Backup-File $FilePath
    }

    $content = Get-Content $FilePath -Raw

    # Port variable updates
    $content = $content -replace "AEP_BUILDER_PORT=4200", "AEP_BUILDER_PORT=6000"
    $content = $content -replace "GRAFANA_PORT=3000", "GRAFANA_PORT=6001"
    $content = $content -replace "JAEGER_UI_PORT=16686", "JAEGER_UI_PORT=6002"
    $content = $content -replace "MINIO_CONSOLE_PORT=9001", "MINIO_CONSOLE_PORT=6003"
    $content = $content -replace "AEP_API_GATEWAY_PORT=3001", "AEP_API_GATEWAY_PORT=7500"
    $content = $content -replace "AEP_PREVIEW_HOST_PORT=3002", "AEP_PREVIEW_HOST_PORT=7501"
    $content = $content -replace "IOT_MOCK_API_PORT=3003", "IOT_MOCK_API_PORT=7502"
    $content = $content -replace "POSTGRES_PORT=5432", "POSTGRES_PORT=7600"
    $content = $content -replace "INFLUXDB_PORT=8086", "INFLUXDB_PORT=7601"
    $content = $content -replace "REDIS_PORT=6379", "REDIS_PORT=7602"
    $content = $content -replace "MINIO_PORT=9000", "MINIO_PORT=7650"
    $content = $content -replace "PROMETHEUS_PORT=9090", "PROMETHEUS_PORT=7700"
    $content = $content -replace "LOKI_PORT=3100", "LOKI_PORT=7750"
    $content = $content -replace "JAEGER_COLLECTOR_PORT=14268", "JAEGER_COLLECTOR_PORT=7775"
    $content = $content -replace "OTLP_HTTP_PORT=4318", "OTLP_HTTP_PORT=7801"
    $content = $content -replace "TELEGRAF_HTTP_PORT=8094", "TELEGRAF_HTTP_PORT=7820"

    # URL updates (be careful with these - only update localhost URLs)
    $content = $content -replace "localhost:4200", "localhost:6000"
    $content = $content -replace "localhost:3000", "localhost:6001"
    $content = $content -replace "localhost:3001", "localhost:7500"
    $content = $content -replace "localhost:3002", "localhost:7501"
    $content = $content -replace "localhost:5432", "localhost:7600"
    $content = $content -replace "localhost:8086", "localhost:7601"
    $content = $content -replace "localhost:6379", "localhost:7602"
    $content = $content -replace "localhost:9000", "localhost:7650"

    if (-not $DryRun) {
        Set-Content -Path $FilePath -Value $content -NoNewline
    }

    Write-Host "  ✓ Updated: $FilePath" -ForegroundColor Green
}

Write-Host "Step 1: Updating Docker Compose files..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------"
Replace-Ports "$ProjectRoot\docker\docker-compose.dev.yml"
Replace-Ports "$ProjectRoot\docker\docker-compose.test.yml"
Replace-Ports "$ProjectRoot\docker\docker-compose.preprod.yml"
Replace-Ports "$ProjectRoot\docker\docker-compose.prod.yml"

Write-Host ""
Write-Host "Step 2: Updating environment files..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------"
Update-EnvironmentFile "$ProjectRoot\.env.example"
Update-EnvironmentFile "$ProjectRoot\.env.development"
Update-EnvironmentFile "$ProjectRoot\.env.preprod"
Update-EnvironmentFile "$ProjectRoot\docker\.env.example"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "✓ Port migration completed successfully!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review the PORT-ALLOCATION.md file for the complete port mapping"
Write-Host "  2. Update your bookmarks and browser cache"
Write-Host "  3. Restart all services to apply the new port configuration"
Write-Host ""
if (-not $DryRun) {
    Write-Host "Backups created with timestamp suffix (.bak-YYYYMMDD-HHMMSS)" -ForegroundColor Yellow
}
Write-Host "===================================================================="-ForegroundColor Cyan
