/**
 * Analyze: LLM Call
 * 
 * HIPAA-SAFE LLM INTEGRATION:
 * - Calls ONLY with sanitized ZeinaInput (no PHI)
 * - No storage of prompts or responses
 * - Timeout + retry with safe defaults
 * - Adapter pattern for multiple LLM providers
 * 
 * FAIL CLOSED: If LLM fails, returns deterministic fallback
 */

import { logger } from '../../observability/logger';
import type {
  ZeinaInput,
  RawAIResponse,
} from './types';
import {
  RecommendedActionCode,
  EscalationLevel,
} from './types';

/**
 * LLM Provider interface (adapter pattern)
 */
interface LLMProvider {
  name: string;
  call(prompt: string, timeout: number): Promise<RawAIResponse | null>;
}

/**
 * OpenAI Provider
 */
class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async call(prompt: string, timeout: number): Promise<RawAIResponse | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant. Provide structured JSON responses with risk assessment. Always respond with valid JSON. Never provide medical diagnoses.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2, // Low temperature for consistent medical analysis
          max_tokens: 300, // Limit response size
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      const aiResponse: RawAIResponse = JSON.parse(content);
      return aiResponse;

    } catch (error) {
      if ((error as any).name === 'AbortError') {
        throw new Error('LLM call timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Anthropic Provider (stub - can be implemented)
 */
class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  async call(prompt: string, timeout: number): Promise<RawAIResponse | null> {
    // TODO: Implement Anthropic API integration
    throw new Error('Anthropic provider not yet implemented');
  }
}

/**
 * Get configured LLM provider
 */
function getLLMProvider(): LLMProvider | null {
  const provider = process.env.ZEINA_LLM_PROVIDER || 'openai';
  
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }
    const model = process.env.ZEINA_MODEL || 'gpt-4o-mini';
    return new OpenAIProvider(apiKey, model);
  }

  if (provider === 'anthropic') {
    return new AnthropicProvider();
  }

  return null;
}

/**
 * Call LLM with sanitized input
 * NO PHI is sent to the LLM
 * 
 * @param input - Sanitized ZeinaInput (no PHI)
 * @param prompt - Generated prompt (no PHI)
 * @param traceId - Trace ID for logging
 * @returns RawAIResponse or null on failure
 */
export async function callLLM(
  input: ZeinaInput,
  prompt: string,
  traceId: string
): Promise<RawAIResponse | null> {
  const timeout = parseInt(process.env.ZEINA_TIMEOUT_MS || '8000', 10);
  const maxRetries = parseInt(process.env.ZEINA_MAX_RETRIES || '2', 10);

  logger.debug('Calling LLM', {
    traceId,
    timeout,
    maxRetries,
    fn: 'zeina.analyze.callLLM',
  });

  const provider = getLLMProvider();
  if (!provider) {
    logger.warn('No LLM provider configured, using deterministic fallback', {
      traceId,
      fn: 'zeina.analyze.callLLM',
    });
    return null;
  }

  // Retry logic
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await provider.call(prompt, timeout);
      
      if (response) {
        logger.info('LLM call successful', {
          traceId,
          provider: provider.name,
          attempt: attempt + 1,
          fn: 'zeina.analyze.callLLM',
        });
        return response;
      }

    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      logger.warn(`LLM call failed (attempt ${attempt + 1}/${maxRetries})`, {
        traceId,
        error: (error as Error).message,
        isLastAttempt,
        fn: 'zeina.analyze.callLLM',
      });

      if (isLastAttempt) {
        logger.error('LLM call failed after all retries', error as Error, {
          traceId,
          attempts: maxRetries,
          fn: 'zeina.analyze.callLLM',
        });
        return null;
      }

      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  return null;
}

/**
 * Generate deterministic fallback response
 * Used when LLM is unavailable or fails
 */
export function generateDeterministicResponse(
  input: ZeinaInput,
  traceId: string
): RawAIResponse {
  logger.info('Generating deterministic fallback response', {
    traceId,
    alertType: input.alertType,
    severity: input.severity,
    fn: 'zeina.analyze.generateDeterministicResponse',
  });

  // Calculate risk score based on severity and vital level
  let riskScore = 30; // Default

  if (input.severity === 'critical') {
    riskScore = 75;
  } else if (input.severity === 'warning') {
    riskScore = 50;
  } else {
    riskScore = 25;
  }

  // Adjust for vital level
  if (input.vitalLevel === 'very_high' || input.vitalLevel === 'very_low') {
    riskScore += 15;
  } else if (input.vitalLevel === 'high' || input.vitalLevel === 'low') {
    riskScore += 5;
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  // Determine action code
  let actionCode: RecommendedActionCode;
  if (input.alertType === 'fall') {
    actionCode = RecommendedActionCode.IMMEDIATE_ATTENTION;
  } else if (input.severity === 'critical') {
    actionCode = RecommendedActionCode.CONTACT_PATIENT;
  } else if (input.vitalLevel === 'very_high' || input.vitalLevel === 'very_low') {
    actionCode = RecommendedActionCode.CHECK_VITALS;
  } else {
    actionCode = RecommendedActionCode.MONITOR;
  }

  // Determine escalation level
  let escalationLevel: EscalationLevel;
  if (input.alertType === 'fall' || input.severity === 'critical') {
    escalationLevel = EscalationLevel.CAREGIVER;
  } else if (riskScore >= 70) {
    escalationLevel = EscalationLevel.CAREGIVER;
  } else {
    escalationLevel = EscalationLevel.NONE;
  }

  // Generate summary
  let summary = `${input.alertType} alert`;
  if (input.vitalType) {
    summary = `${input.vitalType} ${input.vitalLevel || 'alert'}`;
  }
  if (input.trend) {
    summary += ` (${input.trend} trend)`;
  }

  return {
    riskScore,
    summary,
    recommendedActionCode: actionCode,
    escalationLevel,
  };
}
