# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### Reporting Process

1. **Email**: Send details to security@friendly-tech.com
2. **GitHub**: Use GitHub Security Advisories (preferred)
3. **Response**: You'll receive acknowledgment within 48 hours

### What to Include

- Type of vulnerability
- Full paths of affected files
- Location of vulnerable code
- Step-by-step reproduction instructions
- Proof-of-concept or exploit code (if possible)
- Potential impact

### Disclosure Policy

- We'll confirm receipt within 48 hours
- We'll provide a detailed response within 7 days
- We'll keep you informed of progress
- We'll credit you in security advisories (if desired)

### Security Best Practices

When using Friendly-AIAEP:

1. **Secrets Management**
   - Never commit secrets to version control
   - Use environment variables for sensitive data
   - Rotate API keys regularly

2. **Authentication**
   - Use strong JWT secrets
   - Enable rate limiting
   - Implement proper RBAC

3. **Data Protection**
   - Encrypt data at rest and in transit
   - Use PostgreSQL SSL connections
   - Implement proper tenant isolation

4. **Dependencies**
   - Keep dependencies updated
   - Run `pnpm audit` regularly
   - Review security advisories

5. **Infrastructure**
   - Use HTTPS/TLS everywhere
   - Implement network segmentation
   - Enable firewall rules
   - Use container security scanning

## Known Security Considerations

### Multi-Tenant Isolation

Friendly-AIAEP implements tenant isolation through:
- Row-level security in PostgreSQL
- Automatic tenant scoping in Prisma
- JWT-based authentication with tenant claims

### LLM Integration

When using LLM providers:
- API keys are stored encrypted
- Prompts are sanitized for injection attacks
- Rate limiting prevents abuse
- Token usage is tracked and billed

### IoT API Integration

- API credentials are encrypted at rest
- Support for multiple authentication methods
- Redis caching with secure key management
- Webhook validation and signature verification

## Security Updates

Security updates are released as:
- Patch versions (x.x.X) for critical fixes
- Minor versions (x.X.x) for important updates

Subscribe to security advisories:
https://github.com/svdwalt007/Friendly-AIAEP/security/advisories

## Contact

- Security Email: security@friendly-tech.com
- Security Advisories: https://github.com/svdwalt007/Friendly-AIAEP/security
- General Contact: support@friendly-tech.com

Thank you for helping keep Friendly-AIAEP and our users safe!
