# CI/CD Pipeline Documentation

**Complete CI/CD Pipeline with GitHub Actions**

Automated build, test, and deployment pipeline for Friendly AI AEP.

---

## Table of Contents

1. [Overview](#overview)
2. [CI Pipeline](#ci-pipeline)
3. [CD Pipeline](#cd-pipeline)
4. [GitHub Actions Workflows](#github-actions-workflows)
5. [Secrets Management](#secrets-management)
6. [Branch Strategy](#branch-strategy)
7. [Quality Gates](#quality-gates)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Pipeline Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Code   │────▶│  Lint &  │────▶│  Build   │────▶│   Test   │
│  Commit  │     │Typecheck │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                          │
                      ┌───────────────────────────────────┘
                      │
                      ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Security │────▶│  Build   │────▶│  Deploy  │────▶│  Verify  │
│   Scan   │     │  Images  │     │ Staging  │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │
                   ┌────────────────────┴─────────────────┐
                   │                                      │
                   ▼                                      ▼
            ┌──────────┐                           ┌──────────┐
            │  Manual  │                           │  Deploy  │
            │ Approval │                           │   Prod   │
            └─────┬────┘                           └──────────┘
                  │
                  └────────────────────────────────────▶
```

---

## CI Pipeline

### GitHub Actions CI Workflow

**.github/workflows/ci.yml:**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
  NODE_VERSION: '20'
  PNPM_VERSION: '10'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - uses: nrwl/nx-set-shas@v4
      - run: pnpm nx affected -t lint --parallel=3

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: friendly_aep_test
        ports:
          - 5432:46100
      redis:
        image: redis:7-alpine
        ports:
          - 6379:46102

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - uses: nrwl/nx-set-shas@v4
      - run: pnpm nx affected -t test --coverage

      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/**/coverage-final.json
```

---

## CD Pipeline

### Deployment Workflow

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options: [staging, production]

jobs:
  build-images:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [aep-api-gateway, aep-builder, aep-preview-host]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/${{ matrix.app }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-images
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.friendly-aiaep.com
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-kubectl@v4
      - run: |
          echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > $HOME/.kube/config
          helm upgrade --install friendly-aep ./deploy/helm \
            --namespace friendly-staging \
            --set image.tag=${{ github.sha }} \
            --wait
```

---

## GitHub Actions Workflows

### Key Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push, PR | Lint, test, build |
| **Deploy** | Tag, Manual | Deploy to environments |
| **Security** | Push | Vulnerability scanning |
| **E2E** | PR, Nightly | End-to-end tests |

---

## Secrets Management

### Required Secrets

**GitHub Repository Secrets:**
```
NX_CLOUD_ACCESS_TOKEN
CODECOV_TOKEN
ANTHROPIC_API_KEY_TEST
ANTHROPIC_API_KEY_STAGING
ANTHROPIC_API_KEY_PRODUCTION
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
KUBE_CONFIG_STAGING
KUBE_CONFIG_PRODUCTION
```

### Configure Secrets

```bash
# Via GitHub CLI
gh secret set ANTHROPIC_API_KEY_PRODUCTION --body "sk-ant-..."

# Via GitHub UI
# Settings > Secrets and variables > Actions > New repository secret
```

---

## Branch Strategy

### Git Flow

```
main (protected)
  └─▶ staging deploys
      └─▶ manual approval
          └─▶ production deploys

develop (integration)
  └─▶ feature branches
      └─▶ pull requests
          └─▶ merge to main
```

### Branch Protection

**main branch rules:**
- Require pull request reviews (2)
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to admins only

---

## Quality Gates

### Pre-Merge Checks

- ESLint passes
- TypeScript compiles
- All tests pass (80% coverage)
- Security scan clean
- No high/critical vulnerabilities
- Code review approved

---

## Troubleshooting

### Failed Workflow

```bash
# View logs
gh run view --log

# Rerun failed jobs
gh run rerun --failed

# Debug with SSH
# Add to workflow:
- uses: mxschmitt/action-tmate@v3
```

---

## Related Documentation

- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md)
- [Kubernetes Guide](./KUBERNETES-GUIDE.md)
- [Testing Strategy](../testing/TESTING-STRATEGY.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
