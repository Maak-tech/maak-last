import { logger } from './logger.js'

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerOptions {
  name: string
  failureThreshold: number    // open after this many consecutive failures
  successThreshold: number    // close after this many consecutive successes (in half-open)
  timeout: number             // ms to wait before attempting half-open probe
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0

  constructor(private opts: CircuitBreakerOptions) {}

  get isOpen(): boolean {
    if (this.state === 'open') {
      // Check if timeout has elapsed — transition to half-open
      if (Date.now() - this.lastFailureTime >= this.opts.timeout) {
        this.state = 'half-open'
        logger.info({ circuit: this.opts.name }, '[CircuitBreaker] Attempting half-open probe')
        return false
      }
      return true
    }
    return false
  }

  recordSuccess(): void {
    this.failureCount = 0
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.opts.successThreshold) {
        this.state = 'closed'
        this.successCount = 0
        logger.info({ circuit: this.opts.name }, '[CircuitBreaker] Circuit closed — service recovered')
      }
    }
  }

  recordFailure(): void {
    this.successCount = 0
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open' || this.failureCount >= this.opts.failureThreshold) {
      this.state = 'open'
      logger.warn({
        circuit: this.opts.name,
        failures: this.failureCount,
      }, '[CircuitBreaker] Circuit opened — too many failures')
    }
  }

  getState(): CircuitState { return this.state }
}

// Singleton for OpenAI
export const openAICircuitBreaker = new CircuitBreaker({
  name: 'openai',
  failureThreshold: 5,    // open after 5 consecutive failures
  successThreshold: 2,    // close after 2 consecutive successes
  timeout: 60_000,        // try again after 1 minute
})
