# Zeina AI Deployment Guide

## Pre-Deployment Checklist

### 1. Legal & Compliance

- [ ] **OpenAI Business Associate Agreement (BAA)** signed
- [ ] HIPAA compliance audit completed
- [ ] Legal review of AI usage approved
- [ ] Privacy policy updated to mention AI analysis
- [ ] Terms of service updated

### 2. Security Review

- [ ] API key management reviewed
- [ ] Environment variables secured
- [ ] Access controls verified
- [ ] Audit logging configured
- [ ] Incident response plan documented

### 3. Testing

- [ ] All unit tests passing (22 tests)
- [ ] Integration tests passing (10 tests)
- [ ] Load testing completed
- [ ] Failover testing completed
- [ ] PHI leak testing completed

### 4. Infrastructure

- [ ] Firebase Functions quota verified
- [ ] OpenAI API quota verified
- [ ] Monitoring dashboards created
- [ ] Alerting rules configured
- [ ] Backup/recovery plan documented

### 5. Documentation

- [ ] Deployment runbook created
- [ ] Rollback procedure documented
- [ ] On-call runbook created
- [ ] Team training completed

---

## Environment Setup

### Development Environment

```bash
# .env.development
ZEINA_ENABLED=true
ZEINA_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-dev-key
ZEINA_MODEL=gpt-4o-mini
ZEINA_TIMEOUT_MS=8000
ZEINA_MAX_RETRIES=2
```

### Staging Environment

```bash
# .env.staging
ZEINA_ENABLED=true
ZEINA_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-staging-key
ZEINA_MODEL=gpt-4o-mini
ZEINA_TIMEOUT_MS=8000
ZEINA_MAX_RETRIES=2
```

### Production Environment

```bash
# .env.production
ZEINA_ENABLED=true
ZEINA_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-prod-key  # From OpenAI with BAA
ZEINA_MODEL=gpt-4o-mini
ZEINA_TIMEOUT_MS=10000
ZEINA_MAX_RETRIES=3

# Feature flags
ZEINA_USE_AI=true  # Set to false to disable AI globally
```

---

## Deployment Steps

### Step 1: Deploy to Staging

```bash
# 1. Switch to staging environment
firebase use staging

# 2. Set environment variables
firebase functions:config:set \
  zeina.enabled=true \
  zeina.llm_provider=openai \
  zeina.model=gpt-4o-mini \
  zeina.timeout_ms=8000 \
  zeina.max_retries=2

firebase functions:secrets:set OPENAI_API_KEY

# 3. Deploy functions
firebase deploy --only functions

# 4. Run smoke tests
npm run test:integration

# 5. Monitor for errors
firebase functions:log --only zeina
```

### Step 2: Staging Validation

```bash
# Run integration tests against staging
npm run test:integration:staging

# Manual testing checklist
# - [ ] Create test vital alert
# - [ ] Verify Zeina analysis runs
# - [ ] Check metrics dashboard
# - [ ] Verify no PHI in logs
# - [ ] Test fail-closed behavior (disable OpenAI)
# - [ ] Verify deterministic fallback works
```

### Step 3: Production Deployment

```bash
# 1. Switch to production
firebase use production

# 2. Set production environment variables
firebase functions:config:set \
  zeina.enabled=true \
  zeina.llm_provider=openai \
  zeina.model=gpt-4o-mini \
  zeina.timeout_ms=10000 \
  zeina.max_retries=3

firebase functions:secrets:set OPENAI_API_KEY

# 3. Deploy to production
firebase deploy --only functions

# 4. Monitor deployment
firebase functions:log --only zeina --follow
```

### Step 4: Post-Deployment Validation

```bash
# 1. Check metrics
# Visit monitoring dashboard
# Verify zeina.calls counter increasing

# 2. Check logs
firebase functions:log --only zeina --limit 100

# 3. Verify no errors
# Check for any guardrail blocks or failures

# 4. Spot check alerts
# Review a few recent alerts for quality
```

---

## Monitoring Setup

### Key Metrics to Monitor

1. **zeina.calls** - Total analysis calls
   - Alert if drops to 0 (service down)
   - Alert if spikes >2x normal (unexpected traffic)

2. **zeina.failures** - Analysis failures
   - Alert if >5% of total calls
   - Page on-call if >10%

3. **zeina.guardrail_blocks** - Validation blocks
   - Alert if >5% of total calls
   - Investigate if trending up

4. **zeina.llm_timeouts** - LLM timeout errors
   - Alert if >10% of LLM calls
   - May need to increase timeout

5. **zeina.duration.over_5s** - Slow analyses
   - Alert if >20% of calls
   - May indicate LLM performance issues

### Google Cloud Monitoring Queries

```sql
-- Zeina call rate
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_count'
| filter resource.function_name =~ 'zeina.*'
| group_by 1m, [value_execution_count_aggregate: aggregate(value.execution_count)]
| every 1m

-- Zeina error rate
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_count'
| filter resource.function_name =~ 'zeina.*'
| filter metric.status != 'ok'
| group_by 1m, [value_execution_count_aggregate: aggregate(value.execution_count)]
| every 1m

-- Zeina latency
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_times'
| filter resource.function_name =~ 'zeina.*'
| group_by 1m, [value_execution_times_mean: mean(value.execution_times)]
| every 1m
```

### Alerting Rules

```yaml
# alerts.yaml

- name: zeina_high_failure_rate
  condition: |
    zeina.failures / zeina.calls > 0.05
  duration: 5m
  severity: warning
  action: notify_on_call

- name: zeina_critical_failure_rate
  condition: |
    zeina.failures / zeina.calls > 0.10
  duration: 2m
  severity: critical
  action: page_on_call

- name: zeina_high_timeout_rate
  condition: |
    zeina.llm_timeouts / zeina.llm_calls > 0.10
  duration: 5m
  severity: warning
  action: notify_team

- name: zeina_guardrail_blocks_trending
  condition: |
    zeina.guardrail_blocks / zeina.calls > 0.05
  duration: 10m
  severity: info
  action: create_ticket

- name: zeina_service_down
  condition: |
    rate(zeina.calls[5m]) == 0
  duration: 5m
  severity: critical
  action: page_on_call
```

### Dashboard Setup

Create dashboards for:

1. **Overview Dashboard**
   - Call rate (last 24h)
   - Success rate (last 24h)
   - Average latency (last 24h)
   - Failure breakdown by type

2. **Performance Dashboard**
   - Latency percentiles (p50, p95, p99)
   - LLM call duration
   - Timeout rate
   - Retry rate

3. **Quality Dashboard**
   - Guardrail block rate
   - Analysis type distribution (AI vs deterministic)
   - Risk score distribution
   - Escalation level distribution

4. **Operations Dashboard**
   - Error rate by type
   - Recent failures (last 100)
   - Active alerts
   - Deployment history

---

## Rollback Procedure

### Immediate Rollback (Emergency)

If Zeina is causing critical issues:

```bash
# Option 1: Disable AI (use deterministic only)
firebase functions:config:set zeina.enabled=false
firebase deploy --only functions

# Option 2: Rollback entire deployment
firebase deploy --only functions --version <previous-version>
```

### Graceful Rollback

If issues are non-critical:

```bash
# 1. Disable AI temporarily
firebase functions:config:set zeina.use_ai=false
firebase deploy --only functions

# 2. Investigate issues
# - Check logs
# - Review metrics
# - Identify root cause

# 3. Fix and redeploy
# - Apply fix
# - Test in staging
# - Deploy to production
```

---

## Incident Response

### Severity Levels

**P0 - Critical (Page immediately)**
- Zeina blocking critical health alerts
- PHI leak detected
- Service completely down
- Error rate >50%

**P1 - High (Notify on-call within 15 min)**
- Error rate >10%
- Timeout rate >20%
- Guardrail blocks >10%

**P2 - Medium (Notify team within 1 hour)**
- Error rate >5%
- Timeout rate >10%
- Guardrail blocks >5%

**P3 - Low (Create ticket)**
- Performance degradation
- Quality issues
- Non-critical errors

### Incident Workflow

1. **Detect** - Alerting system notifies on-call
2. **Assess** - Check dashboards, logs, metrics
3. **Mitigate** - Disable AI if needed, rollback if critical
4. **Investigate** - Identify root cause
5. **Fix** - Apply fix, test in staging
6. **Deploy** - Deploy fix to production
7. **Monitor** - Verify fix works
8. **Document** - Write postmortem

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| High timeout rate | >10% LLM timeouts | Increase `ZEINA_TIMEOUT_MS` or switch to deterministic |
| High guardrail blocks | >5% validation failures | Review AI responses, adjust prompts |
| PHI in logs | Any PHI detected | **IMMEDIATE**: Disable service, audit logs, report incident |
| High latency | P95 >10s | Check OpenAI status, increase timeout |
| Service down | No calls | Check Firebase, check OpenAI API key |

---

## Performance Optimization

### Latency Optimization

1. **Reduce LLM call time**
   - Use `gpt-4o-mini` (faster, cheaper)
   - Reduce `max_tokens` in analyze.ts
   - Cache common responses (future enhancement)

2. **Optimize input processing**
   - inputBuilder is already optimized
   - Avoid unnecessary data fetching

3. **Parallel processing**
   - Process alerts in parallel where possible
   - Use Firebase Function concurrency

### Cost Optimization

1. **Token usage**
   - Monitor `tokensUsed` in metrics
   - Optimize prompt length (inputBuilder)
   - Use cheaper model when possible

2. **Reduce unnecessary calls**
   - Cache recent analyses (future)
   - Skip analysis for low-priority alerts (configurable)

3. **Right-size resources**
   - Adjust Firebase Function memory/CPU
   - Use appropriate OpenAI model tier

---

## Maintenance

### Weekly Tasks

- [ ] Review error logs
- [ ] Check guardrail block rate
- [ ] Review performance metrics
- [ ] Update documentation if needed

### Monthly Tasks

- [ ] Review cost vs. value
- [ ] Analyze AI vs deterministic accuracy
- [ ] Update prompts if needed
- [ ] Review and update action mappings

### Quarterly Tasks

- [ ] HIPAA compliance review
- [ ] Security audit
- [ ] Load testing
- [ ] Team training refresh
- [ ] Update disaster recovery plan

---

## Support Contacts

**On-Call Rotation**
- Primary: <on-call-primary@maak.health>
- Secondary: <on-call-secondary@maak.health>

**Escalation**
- Engineering Manager: <eng-manager@maak.health>
- CTO: <cto@maak.health>

**Vendor Support**
- OpenAI Support: support@openai.com
- Firebase Support: firebase-support@google.com

---

## Quick Reference

### Check Service Status
```bash
firebase functions:log --only zeina --limit 10
```

### Disable AI (Emergency)
```bash
firebase functions:config:set zeina.enabled=false
firebase deploy --only functions
```

### View Metrics
```bash
# Visit monitoring dashboard
https://console.cloud.google.com/monitoring/dashboards/<dashboard-id>
```

### Check Recent Errors
```bash
firebase functions:log --only zeina --filter "severity>=ERROR" --limit 50
```

---

**Deployment Status:** Ready for staging deployment

**Last Updated:** 2026-01-13

**Version:** 1.0.0
