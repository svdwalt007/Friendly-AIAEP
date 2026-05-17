# Global Claude Code Rules Setup

## Overview

This guide explains how to propagate the **Port Security Guidelines** to your global Claude Code configuration, making them available across **all your projects and accounts**.

## What Gets Installed

The port security guidelines will be installed to:
- **Linux/Mac**: `~/.claude/rules/port-security-guidelines.md`
- **Windows**: `%USERPROFILE%\.claude\rules\port-security-guidelines.md`

Once installed, these rules will automatically apply to **all Claude Code sessions** on your system.

## Quick Setup

### Option 1: Automated Setup (Recommended)

#### For Linux/Mac/WSL:

```bash
cd /d/Dev/Friendly-AIAEP
./setup-global-claude-rules.sh
```

#### For Windows (PowerShell):

```powershell
cd d:\Dev\Friendly-AIAEP
.\Setup-GlobalClaudeRules.ps1
```

#### Force Overwrite (No Prompt):

```powershell
# PowerShell
.\Setup-GlobalClaudeRules.ps1 -Force
```

### Option 2: Manual Setup

#### Linux/Mac:

```bash
# Create directory
mkdir -p ~/.claude/rules

# Copy rules
cp /d/Dev/Friendly-AIAEP/.claude/rules/port-security-guidelines.md \
   ~/.claude/rules/

# Verify
cat ~/.claude/rules/port-security-guidelines.md
```

#### Windows (PowerShell):

```powershell
# Create directory
New-Item -ItemType Directory -Path "$env:USERPROFILE\.claude\rules" -Force

# Copy rules
Copy-Item "d:\Dev\Friendly-AIAEP\.claude\rules\port-security-guidelines.md" `
          "$env:USERPROFILE\.claude\rules\"

# Verify
Get-Content "$env:USERPROFILE\.claude\rules\port-security-guidelines.md"
```

## What the Setup Script Does

1. ✅ Detects your operating system (Linux/Mac/Windows/WSL)
2. ✅ Creates `~/.claude/rules` directory if it doesn't exist
3. ✅ Checks for existing rules and offers to backup
4. ✅ Copies port security guidelines to global location
5. ✅ Sets proper file permissions
6. ✅ Displays installation summary and verification commands

## Verification

After installation, verify the rules are in place:

### Linux/Mac/WSL:

```bash
ls -la ~/.claude/rules/
cat ~/.claude/rules/port-security-guidelines.md | head -20
```

### Windows (PowerShell):

```powershell
Get-ChildItem "$env:USERPROFILE\.claude\rules\"
Get-Content "$env:USERPROFILE\.claude\rules\port-security-guidelines.md" | Select-Object -First 20
```

## How Claude Code Uses Global Rules

Once installed, Claude Code will:

1. **Automatically load** these rules at the start of every session
2. **Apply the guidelines** to all port-related decisions
3. **Suggest high ports** (45000+) when creating new services
4. **Warn** about using low or common ports
5. **Recommend** reverse proxy and firewall configurations

## Rules Summary

The installed guidelines cover:

### ✅ Port Selection

- **Use high ports** (45000+)
- **Avoid system ports** (0-1023)
- **Avoid common ports**: 1433, 3306, 5432, 3389, 8080, 8443
- **Make ports configurable** via environment variables

### ✅ Security Requirements

- **Always use reverse proxy** for production
- **Configure firewall** to block external access
- **Never expose high ports** directly to internet
- **Document all ports** in project's PORT-ALLOCATION.md

### ✅ Recommended Port Ranges

- **UI Applications**: 45000-45999
- **APIs**: 46000-46999
- **Databases**: 47000-47999
- **Message Queues**: 48000-48999
- **Observability**: 49000-49999

## Using with Multiple Projects

Once installed globally, the rules apply to:

- ✅ All new Claude Code sessions
- ✅ All existing projects when Claude Code is invoked
- ✅ All team members (if they run the setup script)

### Sharing with Your Team

Share the setup scripts with your team:

```bash
# Clone or copy these files to team repos
setup-global-claude-rules.sh          # For Linux/Mac/WSL users
Setup-GlobalClaudeRules.ps1           # For Windows users
GLOBAL-CLAUDE-RULES-SETUP.md          # This documentation
.claude/rules/port-security-guidelines.md  # The actual rules
```

Team members can then run the setup script in their environment.

## Updating the Rules

To update the global rules:

1. Update `.claude/rules/port-security-guidelines.md` in this project
2. Run the setup script again:
   ```bash
   ./setup-global-claude-rules.sh
   ```
3. Choose "yes" when prompted to overwrite
4. Old version will be backed up automatically

## Removing Global Rules

If you need to remove the global rules:

### Linux/Mac:

```bash
rm ~/.claude/rules/port-security-guidelines.md
```

### Windows:

```powershell
Remove-Item "$env:USERPROFILE\.claude\rules\port-security-guidelines.md"
```

## Troubleshooting

### Rules Not Being Applied

1. **Verify installation:**
   ```bash
   # Linux/Mac
   test -f ~/.claude/rules/port-security-guidelines.md && echo "Installed" || echo "Not found"

   # Windows (PowerShell)
   Test-Path "$env:USERPROFILE\.claude\rules\port-security-guidelines.md"
   ```

2. **Check file permissions:**
   ```bash
   # Linux/Mac
   ls -la ~/.claude/rules/port-security-guidelines.md
   # Should show: -rw-r--r--
   ```

3. **Restart Claude Code session** to pick up new rules

### Permission Denied (Linux/Mac)

```bash
# Fix permissions
chmod 644 ~/.claude/rules/port-security-guidelines.md
```

### Directory Creation Failed (Windows)

Run PowerShell as Administrator:

```powershell
# Run as Administrator
New-Item -ItemType Directory -Path "$env:USERPROFILE\.claude\rules" -Force
```

## Integration with CI/CD

To enforce these rules in CI/CD:

```yaml
# .github/workflows/port-check.yml
name: Port Security Check

on: [push, pull_request]

jobs:
  check-ports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check for low ports
        run: |
          # Fail if any ports below 45000 are used
          if grep -r ":[0-9]\{1,4\}[^0-9]" --include="*.yml" --include="*.yaml" docker/ | grep -E ":(1[0-9]{3}|[2-9][0-9]{3}|[1-3][0-9]{4}|4[0-4][0-9]{3})"; then
            echo "Error: Found ports below 45000"
            exit 1
          fi
```

## Best Practices

1. **Install globally** for consistency across all projects
2. **Update regularly** when rules change
3. **Share with team** so everyone follows same guidelines
4. **Backup** before overwriting existing rules
5. **Document exceptions** if you must deviate from guidelines

## Support

If you encounter issues:

1. Check this documentation
2. Verify file exists at correct location
3. Check file permissions
4. Restart Claude Code
5. Review PORT-ALLOCATION.md for project-specific details

## Additional Resources

- [PORT-ALLOCATION.md](PORT-ALLOCATION.md) - Complete port mapping for this project
- [HIGH-PORT-MIGRATION-SUMMARY.md](HIGH-PORT-MIGRATION-SUMMARY.md) - Migration guide
- [.claude/rules/port-security-guidelines.md](.claude/rules/port-security-guidelines.md) - The rules themselves

---

**Ready to install?** Run the setup script for your platform and the rules will be available globally in seconds!
