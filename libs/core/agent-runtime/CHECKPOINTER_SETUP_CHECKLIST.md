# PostgreSQL Checkpointer - Setup Checklist

Use this checklist to ensure proper setup of the PostgreSQL checkpointer for the AEP multi-agent system.

## Development Setup

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] pnpm package manager installed
- [ ] Docker installed (for PostgreSQL)
- [ ] Git repository cloned

### Database Setup
- [ ] PostgreSQL container running
  ```bash
  docker-compose -f libs/core/agent-runtime/docker-compose.checkpointer.yml up -d
  ```
- [ ] Database accessible on localhost:5432
- [ ] Test connection:
  ```bash
  docker exec -it aep-agent-postgres psql -U postgres -d aep_dev -c "SELECT 1;"
  ```

### Environment Configuration
- [ ] Copy `.env.example` to `.env`
  ```bash
  cp libs/core/agent-runtime/.env.example .env
  ```
- [ ] Update database credentials in `.env`
- [ ] Verify environment variables are loaded

### Dependencies
- [ ] Install project dependencies
  ```bash
  pnpm install
  ```
- [ ] Verify checkpointer dependencies:
  - [ ] @langchain/langgraph-checkpoint-postgres
  - [ ] pg
  - [ ] @types/pg

### Code Integration
- [ ] Import checkpointer in your code
  ```typescript
  import { createCheckpointer } from '@friendly-aiaep/agent-runtime';
  ```
- [ ] Create checkpointer instance
- [ ] Integrate with agent graph
- [ ] Test basic functionality

### Testing
- [ ] Run unit tests
  ```bash
  nx test agent-runtime --testPathPattern=checkpointer
  ```
- [ ] Verify tests pass
- [ ] Run integration test (if available)

### Verification
- [ ] Start your application
- [ ] Create a test conversation
- [ ] Check database for checkpoint
  ```sql
  SELECT COUNT(*) FROM checkpoints;
  ```
- [ ] Resume conversation with same thread_id
- [ ] Verify state is restored

## Production Setup

### Infrastructure
- [ ] Provision PostgreSQL instance
  - [ ] Version 12 or higher
  - [ ] Appropriate instance size for workload
  - [ ] Automated backups enabled
  - [ ] Multi-AZ/High availability configured

### Security
- [ ] Strong database password generated
- [ ] Database not publicly accessible
- [ ] VPC/Private network configured
- [ ] SSL/TLS enabled
  ```typescript
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem').toString(),
  }
  ```
- [ ] Secrets management configured (AWS Secrets Manager, etc.)
- [ ] Database user with least privilege created
- [ ] Password rotation policy implemented

### Configuration
- [ ] Environment variables set in production
  - [ ] POSTGRES_HOST
  - [ ] POSTGRES_PORT
  - [ ] POSTGRES_DB
  - [ ] POSTGRES_USER
  - [ ] POSTGRES_PASSWORD (from secrets manager)
  - [ ] POSTGRES_MAX_CONNECTIONS (50+)
  - [ ] POSTGRES_SSL=true
- [ ] Connection pool size configured for load
- [ ] Timeouts configured appropriately

### Database Optimization
- [ ] Table created and indexed
  ```bash
  psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB < migrations/001_create_checkpoints_table.sql
  ```
- [ ] Indexes verified
  ```sql
  \d checkpoints
  ```
- [ ] Query performance tested
- [ ] Vacuum scheduled (if needed)

### Monitoring
- [ ] Database monitoring enabled
  - [ ] Connection count
  - [ ] Query performance
  - [ ] Table size
  - [ ] Disk usage
- [ ] Application monitoring enabled
  - [ ] Pool utilization
  - [ ] Checkpoint operations
  - [ ] Error rates
- [ ] Alerts configured
  - [ ] Connection failures
  - [ ] High pool usage
  - [ ] Slow queries
  - [ ] Disk space low

### Health Checks
- [ ] Liveness probe implemented
  ```typescript
  app.get('/healthz', async (req, res) => {
    await checkpointer.pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  ```
- [ ] Readiness probe implemented
  ```typescript
  app.get('/readyz', async (req, res) => {
    await checkpointer.pool.query('SELECT COUNT(*) FROM checkpoints LIMIT 1');
    res.json({ status: 'ready' });
  });
  ```
- [ ] Health checks tested

### Maintenance
- [ ] Cleanup script scheduled
  ```bash
  # Run weekly
  psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB < migrations/cleanup_old_checkpoints.sql
  ```
- [ ] Backup verification process
- [ ] Restore procedure documented
- [ ] Monitoring dashboard created

### Deployment
- [ ] Graceful shutdown implemented
  ```typescript
  process.on('SIGTERM', async () => {
    await checkpointer.close();
    process.exit(0);
  });
  ```
- [ ] Connection retry logic implemented
- [ ] Error handling tested
- [ ] Fallback strategy defined (if applicable)

### Documentation
- [ ] Production configuration documented
- [ ] Runbooks created
  - [ ] Connection issues
  - [ ] Pool exhaustion
  - [ ] Table bloat
  - [ ] Performance degradation
- [ ] Oncall procedures defined
- [ ] Disaster recovery plan documented

### Testing
- [ ] Load testing performed
- [ ] Failover tested
- [ ] Backup/restore tested
- [ ] Performance benchmarked

## Post-Deployment

### Verification
- [ ] Application starts successfully
- [ ] Checkpoints are being created
  ```sql
  SELECT COUNT(*) FROM checkpoints WHERE created_at > NOW() - INTERVAL '1 hour';
  ```
- [ ] State resumption working
- [ ] No connection errors in logs
- [ ] Monitoring dashboards showing data

### Performance
- [ ] Response times acceptable
- [ ] Pool utilization healthy (<80%)
- [ ] No slow query warnings
- [ ] Database CPU/memory normal

### Maintenance Schedule
- [ ] Daily: Monitor metrics
- [ ] Weekly: Run cleanup script
- [ ] Monthly: Review table size and performance
- [ ] Quarterly: Review and update capacity

## Troubleshooting Checklist

If issues occur:

### Connection Issues
- [ ] Verify database is running
- [ ] Check network connectivity
- [ ] Verify credentials
- [ ] Check firewall rules
- [ ] Review security groups

### Performance Issues
- [ ] Check connection pool size
- [ ] Review slow query log
- [ ] Verify indexes exist
- [ ] Check table bloat
- [ ] Review monitoring metrics

### Data Issues
- [ ] Verify table exists
- [ ] Check permissions
- [ ] Review error logs
- [ ] Test manual queries
- [ ] Verify data integrity

## Support Resources

- [ ] Documentation reviewed:
  - [ ] [Quick Start Guide](./CHECKPOINTER_QUICK_START.md)
  - [ ] [API Reference](./CHECKPOINTER_README.md)
  - [ ] [Examples](./CHECKPOINTER_EXAMPLES.md)
  - [ ] [Implementation Summary](./CHECKPOINTER_IMPLEMENTATION_SUMMARY.md)

- [ ] Team trained on:
  - [ ] Basic usage
  - [ ] Troubleshooting
  - [ ] Monitoring
  - [ ] Maintenance procedures

## Sign-Off

Development Setup:
- [ ] Developer: _________________ Date: _______
- [ ] Reviewed by: ______________ Date: _______

Production Setup:
- [ ] DevOps Engineer: __________ Date: _______
- [ ] Security Review: __________ Date: _______
- [ ] Technical Lead: ___________ Date: _______

Notes:
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```
