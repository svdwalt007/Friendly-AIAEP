# GitHub Actions Workflows

This directory contains comprehensive CI/CD workflows for the Friendly AIAEP project.

## Workflows Overview

### Core Workflows

#### 1. CI Workflow (`ci.yml`)
Main continuous integration workflow that runs on every push and pull request.

**Features:**
- Multi-environment support (dev, test, preprod, prod)
- Matrix builds across Node.js versions (20, 22)
- Parallel job execution with strategic caching
- Comprehensive testing (lint, typecheck, unit, E2E)
- Enhanced security scanning with CodeQL and OSSF Scorecard
- Visual regression testing for PRs
- Intelligent caching for pnpm and Nx
- Automated coverage reporting to Codecov
- Slack notifications on completion

**Triggered by:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch

#### 2. Deploy Workflow (`deploy.yml`)
Advanced deployment workflow with multiple strategies and environments.

**Features:**
- Multi-environment deployment (dev, test, preprod, staging, production)
- Blue-green deployment support
- Canary deployment option
- Rolling update deployment
- Automated smoke tests post-deployment
- Automatic rollback on failure
- Deployment approval gates via GitHub environments
- Slack and Microsoft Teams notifications
- Deployment snapshots for rollback

**Triggered by:**
- Push to `main` branch
- Git tags (`v*`)
- Manual workflow dispatch with environment selection

**Deployment Strategies:**
- **Rolling Update**: Default strategy, gradual rollout
- **Blue-Green**: Zero-downtime deployment with instant rollback
- **Canary**: Gradual traffic shift for safer deployments

#### 3. Preview Deployment (`preview.yml`)
Automatic preview environments for pull requests.

**Features:**
- Automatic preview deployment on PR open/update
- Unique namespace per PR
- Automatic cleanup on PR close
- PR comments with preview URLs
- Isolated database and resources
- Smoke tests for preview environments

**Triggered by:**
- Pull request events (opened, synchronize, reopened, closed)

#### 4. E2E Testing (`e2e.yml`)
Comprehensive end-to-end testing across browsers and devices.

**Features:**
- Cross-browser testing (Chromium, Firefox, WebKit)
- Test sharding for parallel execution (4 shards)
- Mobile device testing (iPhone, Pixel, iPad, Samsung)
- Accessibility testing with Axe
- Visual regression testing
- Test report aggregation
- GitHub Pages deployment for reports
- Trace and screenshot capture on failure

**Triggered by:**
- Manual workflow dispatch
- Daily schedule (2 AM UTC)
- Push to main affecting apps/libs

#### 5. Security Scanning (`security.yml`)
Multi-layered security scanning and compliance checking.

**Features:**
- Dependency vulnerability scanning (npm audit, Snyk, OWASP)
- Code security analysis (CodeQL, Semgrep, SonarCloud)
- Container scanning (Trivy, Anchore, Grype)
- Secret scanning (Gitleaks, TruffleHog)
- SBOM generation (CycloneDX, SPDX, Syft)
- License compliance checking
- OSSF Scorecard
- Infrastructure as Code scanning (Checkov)

**Triggered by:**
- Push to `main` or `develop`
- Pull requests
- Weekly schedule (Mondays at 6 AM UTC)
- Manual workflow dispatch

#### 6. Performance Testing (`performance.yml`)
Comprehensive performance benchmarking and monitoring.

**Features:**
- Lighthouse CI audits for web performance
- Web Vitals monitoring
- Bundle size analysis
- Load testing with k6
- Artillery load testing
- API performance testing
- Memory profiling
- Performance budgets
- Trend tracking and reporting

**Triggered by:**
- Manual workflow dispatch
- Daily schedule (4 AM UTC)
- Pull requests affecting apps/libs

### Reusable Workflows

Located in `.github/workflows/reusable/`:

#### Build Workflow (`build.yml`)
Reusable build workflow for consistent builds across environments.

**Inputs:**
- `node-version`: Node.js version (default: '20')
- `environment`: Target environment (default: 'dev')
- `parallel-tasks`: Number of parallel tasks (default: 3)
- `cache-key-prefix`: Cache key prefix

**Outputs:**
- `build-version`: Generated build version
- `artifact-name`: Name of build artifacts

#### Test Workflow (`test.yml`)
Reusable test workflow for different test types.

**Inputs:**
- `node-version`: Node.js version (default: '20')
- `test-type`: Type of tests (unit, integration, e2e)
- `coverage`: Enable coverage (default: true)
- `parallel-tasks`: Number of parallel tasks (default: 3)

**Outputs:**
- `test-result`: Test execution result
- `coverage-percentage`: Code coverage percentage

#### Deploy Workflow (`deploy.yml`)
Reusable deployment workflow for any environment.

**Inputs:**
- `environment`: Target environment (required)
- `image-tag`: Docker image tag (required)
- `deployment-strategy`: Strategy (rolling, blue-green, canary)
- `replica-count`: Number of replicas
- `skip-smoke-tests`: Skip smoke tests
- `auto-rollback`: Enable auto rollback

**Outputs:**
- `deployment-url`: Deployed application URL
- `deployment-status`: Deployment status

## Configuration Files

### Lighthouse Budget (`lighthouse/budget.json`)
Performance budgets for Lighthouse CI:
- Script: 300 KB
- Stylesheet: 100 KB
- Images: 500 KB
- Total: 1 MB
- FCP: < 2s
- LCP: < 2.5s
- CLS: < 0.1

### K6 Load Tests (`performance/k6-tests.js`)
K6 load testing scenarios:
- **Normal Load**: 10 VUs sustained
- **Peak Load**: 50 VUs sustained
- **Stress Test**: Ramp up to 200 VUs

### Artillery Config (`performance/artillery-config.yml`)
Artillery load testing configuration:
- Warm-up: 60s at 5 req/s
- Sustained: 300s at 20 req/s
- Peak: 60s at 50 req/s

## Required Secrets

Configure these secrets in your GitHub repository settings:

### CI/CD Secrets
- `NX_CLOUD_ACCESS_TOKEN`: Nx Cloud access token (optional)
- `CODECOV_TOKEN`: Codecov upload token
- `GITHUB_TOKEN`: Automatically provided by GitHub

### Deployment Secrets
- `KUBE_CONFIG_TEST`: Kubernetes config for test environment
- `KUBE_CONFIG_STAGING`: Kubernetes config for staging
- `KUBE_CONFIG_PREPROD`: Kubernetes config for pre-production
- `KUBE_CONFIG_PRODUCTION`: Kubernetes config for production
- `KUBE_CONFIG_PREVIEW`: Kubernetes config for preview environments

### Security Scanning Secrets
- `SNYK_TOKEN`: Snyk security scanning token
- `SONAR_TOKEN`: SonarCloud token
- `GITLEAKS_LICENSE`: Gitleaks license key (optional)
- `SEMGREP_APP_TOKEN`: Semgrep token (optional)

### Notification Secrets
- `SLACK_WEBHOOK_URL`: Slack webhook for notifications
- `TEAMS_WEBHOOK_URL`: Microsoft Teams webhook

## GitHub Environments

Configure these environments in your repository:

### Development
- **URL**: https://dev.friendly-aiaep.com
- **Protection Rules**: None
- **Approvers**: Not required

### Test
- **URL**: https://test.friendly-aiaep.com
- **Protection Rules**: None
- **Approvers**: Not required

### Staging
- **URL**: https://staging.friendly-aiaep.com
- **Protection Rules**: Wait timer (5 minutes)
- **Approvers**: Not required

### Pre-Production
- **URL**: https://preprod.friendly-aiaep.com
- **Protection Rules**: Required reviewers (1)
- **Approvers**: Team leads

### Production
- **URL**: https://friendly-aiaep.com
- **Protection Rules**: Required reviewers (2)
- **Approvers**: Senior developers and team leads
- **Branch Protection**: Only deploy from `main` or `v*` tags

### Preview (Dynamic)
- **URL Pattern**: https://pr-{number}.preview.friendly-aiaep.com
- **Protection Rules**: None
- **Lifecycle**: Automatic cleanup on PR close

## Workflow Best Practices

### 1. Caching Strategy
- **pnpm Store**: Shared across all workflows
- **Nx Cache**: Isolated per workflow type
- **Playwright Browsers**: Cached by lock file hash
- **Docker Layers**: GitHub Actions cache

### 2. Parallel Execution
- Matrix builds run in parallel
- Independent jobs run concurrently
- Sharded E2E tests for faster execution
- Configurable parallelism via inputs

### 3. Error Handling
- Continue-on-error for non-critical steps
- Automatic rollback on deployment failure
- Artifact upload on test failures
- Comprehensive error reporting

### 4. Security
- SARIF upload to GitHub Security tab
- Dependency vulnerability tracking
- Secret scanning on every commit
- Regular security audits

### 5. Performance
- Incremental builds with Nx affected
- Strategic caching for dependencies
- Optimized Docker layer caching
- Parallel test execution

## Usage Examples

### Running CI Manually
```bash
gh workflow run ci.yml \
  --ref main \
  -f environment=staging \
  -f skip_e2e=false
```

### Deploying to Staging
```bash
gh workflow run deploy.yml \
  --ref main \
  -f environment=staging \
  -f deployment_strategy=blue-green \
  -f skip_smoke_tests=false
```

### Running E2E Tests
```bash
gh workflow run e2e.yml \
  --ref main \
  -f environment=staging \
  -f browser=chromium
```

### Security Scan
```bash
gh workflow run security.yml \
  --ref main \
  -f scan_type=all
```

### Performance Testing
```bash
gh workflow run performance.yml \
  --ref main \
  -f environment=staging \
  -f duration=10
```

## Monitoring and Observability

### GitHub Actions Insights
- View workflow runs in Actions tab
- Monitor success/failure rates
- Track execution times
- Review logs and artifacts

### External Integrations
- **Codecov**: Code coverage trends
- **SonarCloud**: Code quality metrics
- **Snyk**: Vulnerability dashboard
- **Slack**: Real-time notifications
- **GitHub Security**: Vulnerability alerts

## Troubleshooting

### Common Issues

**1. Workflow Fails on Cache Restore**
- Clear cache in Actions tab
- Update cache keys in workflow

**2. Deployment Rollback**
- Check smoke test logs
- Review deployment events in Kubernetes
- Verify image tags

**3. E2E Test Failures**
- Download trace files from artifacts
- Review screenshots
- Check Playwright report

**4. Security Scan False Positives**
- Review SARIF files
- Update security policies
- Suppress known issues

## Contributing

When modifying workflows:

1. Test changes in a feature branch
2. Use workflow_dispatch for manual testing
3. Review logs for performance impacts
4. Update documentation
5. Request peer review

## Support

For issues or questions:
- Open a GitHub issue
- Contact DevOps team via Slack
- Review workflow logs
- Check GitHub Actions documentation

---

**Last Updated**: 2026-04-15
**Maintained By**: DevOps Team
**Version**: 2.0.0
