# Setup Global Claude Code Port Security Guidelines (PowerShell)
# This script copies port security rules to your global Claude Code configuration

param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRules = Join-Path $ScriptDir ".claude\rules\port-security-guidelines.md"

Write-Host "=================================================================="  -ForegroundColor Cyan
Write-Host "Claude Code Global Port Security Rules Setup" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Set global paths
$GlobalClaudeDir = Join-Path $env:USERPROFILE ".claude\rules"
$GlobalRulesFile = Join-Path $GlobalClaudeDir "port-security-guidelines.md"

Write-Host "Detected configuration:" -ForegroundColor Blue
Write-Host "  User Profile: " -NoNewline
Write-Host $env:USERPROFILE -ForegroundColor Yellow
Write-Host "  Global Claude Dir: " -NoNewline
Write-Host $GlobalClaudeDir -ForegroundColor Yellow
Write-Host "  Rules File: " -NoNewline
Write-Host $GlobalRulesFile -ForegroundColor Yellow
Write-Host ""

# Check if source file exists
if (-not (Test-Path $SourceRules)) {
    Write-Host "✗ Source rules file not found: $SourceRules" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found source rules file" -ForegroundColor Green

# Create global Claude directory if it doesn't exist
if (-not (Test-Path $GlobalClaudeDir)) {
    Write-Host "Creating global Claude rules directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $GlobalClaudeDir -Force | Out-Null
    Write-Host "✓ Created: $GlobalClaudeDir" -ForegroundColor Green
} else {
    Write-Host "✓ Global Claude rules directory exists" -ForegroundColor Green
}

# Check if rules file already exists
if (Test-Path $GlobalRulesFile) {
    Write-Host ""
    Write-Host "⚠ Port security rules already exist globally" -ForegroundColor Yellow
    Write-Host "  Location: $GlobalRulesFile" -ForegroundColor Yellow
    Write-Host ""

    if (-not $Force) {
        $confirm = Read-Host "Do you want to overwrite? (yes/no)"

        if ($confirm -ne "yes") {
            Write-Host "Setup cancelled. Existing rules preserved." -ForegroundColor Yellow
            exit 0
        }
    }

    # Backup existing file
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupFile = "$GlobalRulesFile.backup-$timestamp"
    Copy-Item $GlobalRulesFile $BackupFile
    Write-Host "✓ Backed up existing rules to: $BackupFile" -ForegroundColor Green
}

# Copy rules file
Write-Host ""
Write-Host "Copying port security rules to global configuration..." -ForegroundColor Cyan
Copy-Item $SourceRules $GlobalRulesFile -Force

if ($?) {
    Write-Host "✓ Successfully copied rules to global location" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to copy rules" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Port security guidelines installed globally at:" -ForegroundColor Blue
Write-Host "  $GlobalRulesFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "These rules will now apply to ALL your Claude Code projects!" -ForegroundColor Blue
Write-Host ""
Write-Host "Guidelines Summary:" -ForegroundColor Yellow
Write-Host "  • Use high ports (45000+) for all services"
Write-Host "  • Avoid system ports (0-1023)"
Write-Host "  • Avoid common ports (1433, 3306, 5432, 8080, 8443)"
Write-Host "  • Make all ports configurable via environment variables"
Write-Host "  • Use reverse proxy for production"
Write-Host "  • Configure firewall to block external access to high ports"
Write-Host ""
Write-Host "To verify installation:" -ForegroundColor Cyan
Write-Host "  Get-Content `"$GlobalRulesFile`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "To use with force (no prompt):" -ForegroundColor Cyan
Write-Host "  .\Setup-GlobalClaudeRules.ps1 -Force" -ForegroundColor Yellow
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
