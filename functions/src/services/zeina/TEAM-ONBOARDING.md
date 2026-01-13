# Zeina AI Team Onboarding

**Get your team up to speed with Zeina AI**

---

## 👋 Welcome to Zeina

Zeina is Maak's AI-powered health alert analysis system. It provides intelligent risk assessment and actionable recommendations while maintaining strict HIPAA compliance.

**What Zeina does:**
- Analyzes health alerts (vitals, symptoms, falls)
- Calculates risk scores (0-100)
- Recommends actions (enum-based, deterministic)
- Determines escalation level (none, caregiver, emergency)
- Maps to concrete backend actions

**What Zeina doesn't do:**
- ❌ Make medical diagnoses
- ❌ Access raw PHI
- ❌ Block critical alerts
- ❌ Store AI conversations
- ❌ Make autonomous medical decisions

---

## 🎓 30-Minute Onboarding

### Minute 0-5: Overview

**Read:** [INDEX.md](./INDEX.md) - Navigation to all resources

**Key Concepts:**
1. PHI Boundary - All patient data sanitized before AI
2. Fail-Closed - System never blocks alerts
3. Deterministic - AI output → concrete actions
4. Observable - Complete metrics (NO PHI)

### Minute 5-15: Hands-On Setup

```bash
# 1. Navigate to Zeina
cd functions/src/services/zeina

# 2. Run setup
./scripts/setup.sh

# 3. Run tests
./scripts/test.sh all

# 4. Try it out
npm test -- services/zeina/__tests__/integration.test.ts
```

**Expected:** All tests pass ✅

### Minute 15-25: Code Walkthrough

**Open these files in order:**

1. **types.ts** (2 min)
   - See `AlertContext` (may contain PHI)
   - See `ZeinaInput` (NO PHI - safe for AI)
   - See `ZeinaOutput` (structured result)

2. **inputBuilder.ts** (3 min)
   - Find `bucketVitalValue()` - converts 125 → "high"
   - Find `ageToGroup()` - converts 68 → "senior"
   - This is WHERE PHI GETS SANITIZED

3. **index.ts** (3 min)
   - Find `runZeinaAnalysis()` - main entry point
   - See the fail-closed logic
   - Notice it ALWAYS returns success

4. **outputMapper.ts** (2 min)
   - See `mapToBackendActions()`
   - Notice deterministic mapping
   - ActionCode → CTA, Recipients, Automation

### Minute 25-30: Test in Console

```typescript
// In Node REPL or test file
import { runTestAnalysis, printMetrics } from './services/zeina/utils';

// Run analysis
const result = await runTestAnalysis();
console.log(result.output.riskScore); // 50-80

// View metrics
printMetrics();
```

---

## 🎯 Role-Based Learning Paths

### Backend Engineers

**Must Know:**
1. How to call `runZeinaAnalysis()`
2. How to handle `ZeinaAnalysisResult`
3. PHI boundary (inputBuilder.ts)
4. Fail-closed behavior

**Code to Review:**
- index.ts (public API)
- adapter.ts (backward compatibility)
- example-usage.ts (integration patterns)

**Tasks:**
1. Integrate Zeina into new alert type
2. Add custom action mapping
3. Write integration test

**Time:** 2-4 hours

### Frontend Engineers

**Must Know:**
1. Zeina enriches alerts in Firestore
2. Alerts have `zeinaAnalysis` field
3. App should show risk score + recommendations
4. Zeina doesn't replace human judgment

**Firestore Structure:**
```javascript
{
  alertId: "alert_123",
  type: "vital",
  severity: "warning",
  zeinaAnalysis: {
    riskScore: 65,
    riskLevel: "high",
    summary: "Elevated heart rate detected",
    recommendedActions: [...],
    analyzedAt: timestamp
  }
}
```

**Tasks:**
1. Display risk score in UI
2. Show recommended actions
3. Add visual indicators

**Time:** 1-2 hours

### DevOps / SRE

**Must Know:**
1. Monitoring dashboards
2. Alert thresholds
3. Rollback procedures
4. Health check endpoints

**Key Files:**
- DEPLOYMENT.md (operations guide)
- monitoring.ts (health checks)
- scripts/health-check.sh (automated checks)

**Tasks:**
1. Set up monitoring dashboards
2. Configure alerting rules
3. Practice rollback procedure
4. Run load tests

**Time:** 4-8 hours

### Compliance / Legal

**Must Know:**
1. Zero PHI sent to OpenAI
2. All data sanitized (inputBuilder.ts)
3. OpenAI BAA required for production
4. Complete audit trail

**Key Files:**
- README.md § HIPAA Compliance
- inputBuilder.ts (PHI sanitization)
- DEPLOYMENT.md § Pre-Deployment

**Evidence:**
- Unit tests verify PHI sanitization
- Integration tests verify no leaks
- Audit logs contain NO PHI (only IDs)

**Time:** 2-3 hours

### Product Managers

**Must Know:**
1. Zeina provides risk scores + recommendations
2. Non-diagnostic (informational only)
3. Fail-closed (never blocks alerts)
4. Requires OpenAI BAA for production

**Business Value:**
- Better alert prioritization
- Actionable recommendations
- Reduced caregiver cognitive load
- Faster response to critical situations

**Metrics:**
- Alert response time
- False positive rate
- Caregiver satisfaction
- Patient outcomes

**Time:** 1 hour

---

## 🧪 Training Exercises

### Exercise 1: Run Test Analysis (5 min)

```typescript
import { runTestAnalysis } from './services/zeina/utils';

// Run with default values
const result1 = await runTestAnalysis();
console.log('Risk score:', result1.output.riskScore);

// Run with custom severity
const result2 = await runTestAnalysis({ severity: 'critical' });
console.log('Escalation:', result2.output.escalationLevel);

// Run with fall alert
const result3 = await runTestAnalysis({ alertType: 'fall' });
console.log('Recipients:', result3.output.escalationLevel);
```

**Expected:** All succeed, varying risk scores

### Exercise 2: Verify PHI Sanitization (10 min)

```typescript
import { testPHISanitization } from './services/zeina/utils';

const result = await testPHISanitization();
console.log('Passed:', result.passed);
console.log('Issues:', result.issues);
```

**Expected:** `passed: true`, `issues: []`

### Exercise 3: Simulate Alert Load (15 min)

```typescript
import { simulateAlerts, printMetrics } from './services/zeina/utils';

// Simulate 10 alerts
await simulateAlerts(10);

// View metrics
printMetrics();
```

**Expected:** See `zeina.calls: 10`, various analysis types

### Exercise 4: Integration Test (20 min)

Create a new alert type integration:

```typescript
async function handleMyCustomAlert(alertId: string, patientId: string) {
  const result = await runZeinaAnalysis({
    traceId: createTraceId(),
    alertContext: {
      alertId,
      patientId,
      alertType: 'vital', // or your custom type
      severity: 'warning',
    },
  });

  if (result.output) {
    const actions = await executeZeinaActions(
      result.output,
      alertContext,
      traceId
    );
    
    // Handle actions...
  }
}
```

---

## 📚 Required Reading

**Day 1:**
1. [INDEX.md](./INDEX.md) - Navigation (5 min)
2. [QUICKSTART.md](./QUICKSTART.md) - Setup (10 min)
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - Visual diagrams (15 min)

**Week 1:**
1. [README.md](./README.md) - Complete guide (30 min)
2. [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Technical details (1 hour)
3. Run all exercises (1 hour)

**Before Production:**
1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Operations (1 hour)
2. [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) - Launch checklist (30 min)

---

## ✅ Certification Checklist

Before you're "Zeina Certified", complete:

- [ ] Read INDEX.md, QUICKSTART.md, ARCHITECTURE.md
- [ ] Run setup successfully
- [ ] All tests pass on your machine
- [ ] Complete Exercise 1-3
- [ ] Explain PHI boundary to colleague
- [ ] Explain fail-closed architecture
- [ ] Can integrate Zeina into new alert type
- [ ] Know where to find documentation
- [ ] Know how to check service health
- [ ] Understand OpenAI BAA requirement

**Time to certification:** 4-8 hours

---

## 🎤 Team Meeting Agenda (1 hour)

### Introduction (15 min)

- What is Zeina?
- Why do we need it?
- What problems does it solve?
- Demo: Show alert → Zeina → actions

### Architecture Walkthrough (20 min)

- PHI boundary (show inputBuilder.ts)
- Fail-closed design (show index.ts)
- Action mapping (show outputMapper.ts)
- Monitoring (show monitoring.ts)

### Live Demo (15 min)

- Run setup script
- Run tests
- Execute `runTestAnalysis()`
- Show metrics dashboard

### Q&A + Next Steps (10 min)

- Questions?
- Review onboarding checklist
- Assign exercises
- Schedule follow-up

---

## 🤔 Common Questions

**Q: What if OpenAI is down?**  
A: Zeina automatically falls back to deterministic analysis. Alerts always go through.

**Q: Can I see the AI prompts?**  
A: Prompts are generated in inputBuilder.ts `buildAnalysisPrompt()`. They contain NO PHI.

**Q: How do I test locally?**  
A: Run `./scripts/setup.sh` then `./scripts/test.sh all`

**Q: Can I customize the action mappings?**  
A: Yes! Edit `outputMapper.ts` `mapActionCodeToCTA()` and related functions.

**Q: How do I deploy?**  
A: See DEPLOYMENT.md. Staging is ready now. Production needs OpenAI BAA.

**Q: What happens to failed analyses?**  
A: Logged to metrics (`zeina.failures`). System continues with deterministic fallback.

**Q: Can I disable AI temporarily?**  
A: Yes! Set `ZEINA_ENABLED=false` in config.

**Q: How do I monitor in production?**  
A: Use `healthCheck()`, `getServiceStats()`, or Cloud Console dashboards.

---

## 📞 Support Channels

- **Documentation:** Start with [INDEX.md](./INDEX.md)
- **Code Questions:** Review [example-usage.ts](./example-usage.ts)
- **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Quick Fixes:** See [QUICKSTART.md § Troubleshooting](./QUICKSTART.md#troubleshooting)

**Engineering Support:**
- Slack: #zeina-ai
- Email: eng-zeina@maak.health
- On-Call: See DEPLOYMENT.md

---

## 🚀 Next Steps After Onboarding

1. **Integration:** Integrate Zeina into your alert handler
2. **Testing:** Write integration tests
3. **Monitoring:** Set up dashboards
4. **Documentation:** Add team-specific notes
5. **Production:** Help with launch checklist

---

**Welcome to the Zeina team! You're now ready to build AI-powered health analysis that's HIPAA-compliant and production-ready.**

**Questions? Check [INDEX.md](./INDEX.md) or reach out to the team.**
