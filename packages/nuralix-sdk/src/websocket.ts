/**
 * NurulixSubscription — manages a real-time WebSocket connection to the
 * Nuralix patient event stream.
 *
 * Instantiated by `NurulixClient.subscribe()`. Never construct this directly.
 *
 * @example
 * const sub = client.subscribe("user_abc123", (msg) => {
 *   if (msg.event === "vhi.updated") console.log("VHI changed:", msg.data);
 *   if (msg.event === "alert.triggered") console.log("Alert:", msg.data);
 * });
 *
 * // Stop receiving updates:
 * sub.unsubscribe();
 */

/** Payload delivered on every real-time event. */
export interface SubscriptionMessage {
  /**
   * Event name. Known values:
   *   "vhi.updated"         — patient's VHI has been recomputed
   *   "vhi.risk_elevated"   — composite risk crossed the elevated threshold
   *   "alert.triggered"     — a new emergency alert was created
   *   "alert.resolved"      — an alert was resolved
   *   "medication.missed"   — a scheduled medication dose was missed
   *   "genetics.processed"  — DNA file processing completed
   */
  event: string;
  /** Event-specific payload (sanitised — no raw rsids, no clinical note text). */
  data: unknown;
  /** ISO 8601 server timestamp. */
  timestamp: string;
}

/** Callback invoked with each incoming event from the server. */
export type SubscriptionCallback = (message: SubscriptionMessage) => void;

/**
 * Manages a persistent WebSocket connection to the Nuralix patient event stream.
 * Reconnects automatically using exponential back-off (1 s → 2 s → 4 s → 30 s cap).
 */
export class NurulixSubscription {
  private ws: WebSocket | null = null;
  private readonly patientId: string;
  private readonly apiKey: string;
  private readonly wsBaseURL: string;
  private readonly callback: SubscriptionCallback;
  /** Set to `true` after `unsubscribe()` to prevent the reconnect loop. */
  private closed = false;
  private reconnectDelay = 1_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** @internal — use `NurulixClient.subscribe()` instead */
  constructor(
    patientId: string,
    apiKey: string,
    wsBaseURL: string,
    callback: SubscriptionCallback
  ) {
    this.patientId = patientId;
    this.apiKey = apiKey;
    this.wsBaseURL = wsBaseURL.replace(/\/$/, "");
    this.callback = callback;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;

    const url =
      `${this.wsBaseURL}/sdk/v1/patients/` +
      `${encodeURIComponent(this.patientId)}/subscribe` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Reset back-off delay on successful connect
      this.reconnectDelay = 1_000;
    };

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as SubscriptionMessage;
        // The server sends an internal "connected" handshake — skip it
        if (msg.event !== "connected") {
          this.callback(msg);
        }
      } catch {
        // Ignore malformed JSON frames
      }
    };

    this.ws.onclose = () => {
      if (!this.closed) {
        // Exponential back-off: 1 s → 2 s → 4 s → … → 30 s cap
        this.reconnectTimer = setTimeout(
          () => this.connect(),
          this.reconnectDelay
        );
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    };

    this.ws.onerror = () => {
      // `onclose` fires immediately after `onerror` — reconnect is handled there
      this.ws?.close();
    };
  }

  /**
   * Send a raw string to the server.
   * Primarily used for keep-alive pings: `sub.send("ping")`.
   * Has no effect if the connection is not currently open.
   */
  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Close the subscription permanently and stop reconnecting.
   * After calling `unsubscribe()` this instance cannot be reused.
   */
  unsubscribe(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client unsubscribed");
      this.ws = null;
    }
  }
}
