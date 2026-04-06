import { logger } from './logger.js'

// Patterns that indicate clinical claims the LLM should not make
const CLINICAL_CLAIM_PATTERNS: RegExp[] = [
  /you (have|may have|might have|could have|are at risk for|show signs of)\s+[\w\s]+/gi,
  /this (indicates|suggests|means|shows)\s+(you have|a diagnosis|a condition)/gi,
  /you should (take|stop taking|increase|decrease)\s+[\w\s]+/gi,
  /\bdiagnos(is|ed|e|ing)\b/gi,
  /\b(prescrib|prescription|dosage change|medication change)\b/gi,
  /you (are|appear to be)\s+(diabetic|hypertensive|hypoglycemic|tachycardic|bradycardic)/gi,
]

const EMERGENCY_SYMPTOM_PATTERNS: RegExp[] = [
  /\b(chest pain|chest tightness|difficulty breathing|shortness of breath|can.t breathe)\b/gi,
  /\b(sudden weakness|sudden numbness|face drooping|arm weakness|speech difficulty)\b/gi,
  /\b(fainting|unconscious|unresponsive|seizure|severe allergic)\b/gi,
]

const EMERGENCY_RESPONSE = (useLocale: string) =>
  useLocale === 'ar'
    ? 'يبدو أن هذه حالة طارئة طبية. يرجى الاتصال بخدمات الطوارئ فوراً.'
    : 'This sounds like a medical emergency. Please call emergency services (911 / 999 / 112) immediately. Do not wait.'

const DISCLAIMER =
  '\n\n*This is not medical advice. Always consult a qualified healthcare professional for medical decisions.*'

export interface GuardrailResult {
  safe: boolean
  output: string
  flaggedPatterns: string[]
  isEmergency: boolean
}

export function applyNoraGuardrails(
  response: string,
  userMessage: string,
  locale: string = 'en',
): GuardrailResult {
  // Check user message for emergency symptoms first
  const isEmergency = EMERGENCY_SYMPTOM_PATTERNS.some((p) => p.test(userMessage))
  if (isEmergency) {
    logger.warn({ locale }, '[nora/guardrails] Emergency symptom detected in user message')
    return {
      safe: false,
      output: EMERGENCY_RESPONSE(locale),
      flaggedPatterns: ['emergency_symptom'],
      isEmergency: true,
    }
  }

  // Scan LLM response for clinical claims
  const flagged: string[] = []
  for (const pattern of CLINICAL_CLAIM_PATTERNS) {
    const matches = response.match(pattern)
    if (matches) flagged.push(...matches.slice(0, 2)) // Cap to avoid log flooding
  }

  if (flagged.length > 0) {
    logger.warn(
      { flaggedCount: flagged.length, samples: flagged.slice(0, 3) },
      '[nora/guardrails] Clinical claim detected in LLM response'
    )
    return {
      safe: false,
      output: response + DISCLAIMER,
      flaggedPatterns: flagged,
      isEmergency: false,
    }
  }

  return { safe: true, output: response, flaggedPatterns: [], isEmergency: false }
}

// Build an anonymized VHI context block — no absolute PHI values
export function buildAnonymizedNoraContext(vhi: {
  riskLevel: string
  riskScore: number
  baselineConfidence: number
  trends?: Record<string, string>
  elevatingFactors?: Array<{ label: string; impact: number }>
  decliningFactors?: Array<{ label: string; impact: number }>
  pendingActions?: Array<{ title: string; priority: string }>
} | null): string {
  if (!vhi) return 'No health index data is available yet.'

  const lines: string[] = []

  // Only include risk tier if baseline is mature enough to be meaningful
  if (vhi.baselineConfidence >= 0.3) {
    lines.push(`Current health risk tier: ${vhi.riskLevel}`)
  } else {
    lines.push('Health profile is still being established (insufficient data for a reliable score).')
  }

  // Only non-stable trends (direction only — no absolute values)
  if (vhi.trends) {
    const nonStable = Object.entries(vhi.trends)
      .filter(([, dir]) => dir !== 'stable')
      .map(([metric, dir]) => `${metric.replace(/_/g, ' ')}: ${dir}`)
    if (nonStable.length > 0) {
      lines.push(`Notable trends: ${nonStable.slice(0, 4).join(', ')}`)
    }
  }

  // Top elevating factors (labels only — no scores)
  if (vhi.elevatingFactors && vhi.elevatingFactors.length > 0) {
    const labels = vhi.elevatingFactors.slice(0, 3).map((f) => f.label)
    lines.push(`Areas of concern: ${labels.join(', ')}`)
  }

  // Pending actions for context
  if (vhi.pendingActions && vhi.pendingActions.length > 0) {
    const highPriority = vhi.pendingActions
      .filter((a) => a.priority === 'high' || a.priority === 'critical')
      .slice(0, 2)
      .map((a) => a.title)
    if (highPriority.length > 0) {
      lines.push(`Recommended actions: ${highPriority.join(', ')}`)
    }
  }

  return lines.join('\n')
}
