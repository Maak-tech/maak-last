import OpenAI from 'openai'
import { logger } from './logger.js'

// Validate at module load — fail fast rather than at first request
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  logger.warn('[openai] OPENAI_API_KEY not set — Nora will return 503')
}

// HIPAA zero-data-retention: requires OpenAI Enterprise/Healthcare BAA
// Without a signed BAA, disable this flag and DO NOT send PHI.
// Set OPENAI_ZDR=true only after BAA is confirmed with OpenAI.
const useZdr = process.env.OPENAI_ZDR === 'true'

export const openai = new OpenAI({
  apiKey: apiKey ?? 'not-configured',
  defaultHeaders: useZdr ? { 'OpenAI-Beta': 'zero-data-retention' } : {},
})

export const OPENAI_CONFIGURED = !!apiKey

// Log ZDR status at startup for ops visibility
logger.info(
  { zdrEnabled: useZdr, configured: OPENAI_CONFIGURED },
  '[openai] Client initialized'
)
