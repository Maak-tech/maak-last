# Zeina AI Quick Start Guide

Get up and running with Zeina AI in 5 minutes.

---

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Set Up Environment

**Option A: Automated Setup (Recommended)**

```bash
cd src/services/zeina/scripts
chmod +x setup.sh
./setup.sh
```

**Option B: Manual Setup**

Create `functions/.env.development`:

```bash
ZEINA_ENABLED=true
ZEINA_LLM_PROVIDER=openai
ZEINA_MODEL=gpt-4o-mini
ZEINA_TIMEOUT_MS=8000
ZEINA_MAX_RETRIES=2
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Run Tests

```bash
# All tests
npm test -- services/zeina/__tests__/

# Or use the test script
cd src/services/zeina/scripts
chmod +x test.sh
./test.sh all
```

Expected output:
```
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
```

---

## 💻 Development Usage

### Test the Service

```typescript
import {
  runTestAnalysis,
  simulateAlerts,
  printMetrics,
} from './services/zeina/utils';

// Run a single test analysis
const result = await runTestAnalysis();
console.log(result.output.riskScore); // 50-80

// Simulate multiple alerts
await simulateAlerts(5);

// View metrics
printMetrics();
```

### Basic Integration

```typescript
import { runZeinaAnalysis, executeZeinaActions } from './services/zeina';
import { createTraceId } from '../../observability/correlation';

// 1. Create alert context
const alertContext = {
  alertId: 'alert_123',
  patientId: 'patient_456',
  alertType: 'vital' as const,
  severity: 'warning' as const,
  vitalType: 'heartRate' as const,
  vitalValue: 125,
  patientAge: 68,
};

// 2. Analyze
const result = await runZeinaAnalysis({
  traceId: createTraceId(),
  alertContext,
});

// 3. Execute actions
if (result.output) {
  const actions = await executeZeinaActions(
    result.output,
    alertContext,
    'trace_123'
  );
  
  console.log('Send alert:', actions.sendAlert);
  console.log('Recipients:', actions.alertRecipients);
  console.log('CTA:', actions.appCTA);
}
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test -- services/zeina/__tests__/
```

### Run Specific Tests

```bash
# Unit tests only
npm test -- services/zeina/__tests__/guardrails.test.ts

# Integration tests only
npm test -- services/zeina/__tests__/integration.test.ts

# Watch mode
npm test -- services/zeina/__tests__/ --watch

# With coverage
npm test -- services/zeina/__tests__/ --coverage
```

### Test Utilities

```typescript
import {
  createTestAlertContext,
  benchmarkAnalysis,
  testPHISanitization,
} from './services/zeina/utils';

// Create test data
const testAlert = createTestAlertContext({
  severity: 'critical',
  vitalValue: 180,
});

// Benchmark performance
const benchmark = await benchmarkAnalysis(10);
console.log('Avg duration:', benchmark.averageDuration, 'ms');

// Test PHI sanitization
const phiTest = await testPHISanitization();
console.log('PHI test passed:', phiTest.passed);
```

---

## 🔍 Monitoring

### Health Check

```typescript
import { healthCheck, generateMonitoringReport } from './services/zeina';

// Simple health check
const health = await healthCheck();
console.log('Healthy:', health.healthy);
console.log('Warnings:', health.warnings);

// Full monitoring report
const report = await generateMonitoringReport();
console.log('Success rate:', report.stats.successRate);
console.log('Anomalies:', report.anomalies.hasAnomalies);
```

### View Metrics

```typescript
import { getMetrics, printMetrics } from './services/zeina';

// Get metrics object
const metrics = getMetrics();
console.log('Total calls:', metrics['zeina.calls']);

// Print formatted summary
printMetrics();
```

---

## 🐛 Debugging

### Enable Debug Logs

Set environment variable:

```bash
export DEBUG=zeina:*
```

Or in code:

```typescript
import { logger } from '../../observability/logger';

logger.debug('Debug message', {
  traceId: 'trace_123',
  fn: 'myFunction',
});
```

### Check Recent Logs (Deployed)

```bash
firebase functions:log --only zeina --limit 20
```

### Test Specific Scenarios

```typescript
// Test critical alert
await runTestAnalysis({
  severity: 'critical',
  vitalType: 'oxygenSaturation',
  vitalValue: 85,
});

// Test fall detection
await runTestAnalysis({
  alertType: 'fall',
  severity: 'critical',
});

// Test deterministic fallback (disable AI)
process.env.ZEINA_ENABLED = 'false';
await runTestAnalysis();
```

---

## 📊 Common Commands

```bash
# Setup environment
./scripts/setup.sh

# Run all tests
./scripts/test.sh all

# Run tests in watch mode
./scripts/test.sh watch

# Run with coverage
./scripts/test.sh coverage

# Health check (after deployment)
./scripts/health-check.sh staging
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZEINA_ENABLED` | `true` | Enable/disable AI |
| `ZEINA_LLM_PROVIDER` | `openai` | LLM provider |
| `ZEINA_MODEL` | `gpt-4o-mini` | Model name |
| `ZEINA_TIMEOUT_MS` | `8000` | Request timeout |
| `ZEINA_MAX_RETRIES` | `2` | Max retry attempts |
| `OPENAI_API_KEY` | - | OpenAI API key |

### Feature Flags

```typescript
// Disable AI (use deterministic only)
process.env.ZEINA_USE_AI = 'false';

// Change model
process.env.ZEINA_MODEL = 'gpt-4';

// Increase timeout
process.env.ZEINA_TIMEOUT_MS = '15000';
```

---

## 📚 Next Steps

1. **Read the docs:**
   - [README.md](./README.md) - Full architecture
   - [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Technical details
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

2. **Integrate with your code:**
   - See [example-usage.ts](./example-usage.ts)
   - Check [MIGRATION.md](./MIGRATION.md) if migrating

3. **Deploy to staging:**
   - Follow [DEPLOYMENT.md § Staging Deployment](./DEPLOYMENT.md#step-1-deploy-to-staging)

4. **Production checklist:**
   - See [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)

---

## ❓ Troubleshooting

### Tests Failing

```bash
# Clear cache
rm -rf node_modules
npm install

# Check environment
cat .env.development

# Run with verbose output
npm test -- services/zeina/__tests__/ --verbose
```

### "OpenAI API key not configured"

```bash
# Check .env file exists
ls functions/.env.development

# Verify key is set
grep OPENAI_API_KEY functions/.env.development

# Or set it now
echo "OPENAI_API_KEY=sk-your-key" >> functions/.env.development
```

### "Module not found"

```bash
# From functions/ directory
npm install

# Check TypeScript compilation
npm run build
```

### High Latency in Tests

This is normal - tests actually call OpenAI API. To speed up:

```bash
# Use deterministic mode for faster tests
export ZEINA_USE_AI=false
npm test
```

---

## 🆘 Getting Help

- **Documentation:** See `/docs` folder
- **Issues:** Check IMPLEMENTATION.md § Troubleshooting
- **Questions:** Review example-usage.ts
- **Support:** Contact engineering team

---

**Time to first working code:** ~5 minutes  
**Time to full integration:** ~30 minutes  
**Time to production:** See [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)
