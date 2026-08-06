import { MitosisReceipt } from "./mitosis_log_reader.ts";

/** Bounded outbox. Beyond this, the OLDEST compost event is dropped. */
export const COMPOST_BUFFER_LIMIT = 1000;
/** Reconnect backoff bounds (ms). */
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 60_000;

export interface CompostSynapseStats {
  connected: boolean;
  /** Events waiting in the outbox right now. */
  buffered: number;
  /** Events silently discarded because the outbox was full. */
  dropped: number;
  /** Events handed to the socket since construction. */
  sent: number;
  /** Consecutive failed connections; drives the backoff. */
  reconnectAttempts: number;
}

/**
 * Zero-copy exhaust channel to the Liquid daemon.
 *
 * Two things this class must be honest about, because it used to be silent
 * about both:
 *
 * 1. **Loss is counted.** The outbox is bounded at 1000, and overflow drops the
 *    oldest event. That is a defensible policy — but the previous version did
 *    it with a bare `shift()` and no record, so a run that discarded thousands
 *    of compost events looked exactly like a run that discarded none. An
 *    unmeasured drop is indistinguishable from correctness.
 * 2. **Reconnects back off.** A fixed 5s retry against a daemon that is simply
 *    not installed is an infinite console-spam loop for the entire lifetime of
 *    the page. Now exponential, 1s → 60s, reset on a successful open.
 */
export class CompostSynapse {
  private ws: WebSocket | null = null;
  private buffer: unknown[] = [];
  private targetUrl: string;
  private droppedCount = 0;
  private sentCount = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private closed = false;

  constructor(targetUrl: string = "ws://127.0.0.1:8080") {
    this.targetUrl = targetUrl;
    this.connect();
  }

  /** Observable state — for the HUD, for tests, and for honest reporting. */
  public stats(): CompostSynapseStats {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      buffered: this.buffer.length,
      dropped: this.droppedCount,
      sent: this.sentCount,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /** Milliseconds until the next reconnect attempt: 1s, 2s, 4s … capped 60s. */
  public nextBackoffMs(): number {
    const exp = RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts);
    return Math.min(exp, RECONNECT_MAX_MS);
  }

  /** Stop reconnecting. Idempotent. */
  public close() {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch { /* already gone */ }
    this.ws = null;
  }

  private connect() {
    if (this.closed) return;
    try {
      this.ws = new WebSocket(this.targetUrl);
      this.ws.onopen = () => {
        console.log(
          `🍂 [Synapse] Connected to Liquid Swarm at ${this.targetUrl}` +
            (this.droppedCount > 0
              ? ` (${this.droppedCount} event(s) were dropped while offline)`
              : ""),
        );
        this.reconnectAttempts = 0;
        // Flush outbox
        while (this.buffer.length > 0) {
          const msg = this.buffer.shift();
          this.ws?.send(JSON.stringify(msg));
          this.sentCount++;
        }
      };
      this.ws.onerror = (e) => {
        // Only announce the first failure of a streak; after that the backoff
        // line below carries the signal without flooding the console.
        if (this.reconnectAttempts === 0) {
          console.warn(
            `🍂 [Synapse] WebSocket error. Liquid daemon might be offline.`,
            e,
          );
        }
      };
      this.ws.onclose = () => {
        if (this.closed) return;
        const delay = this.nextBackoffMs();
        this.reconnectAttempts++;
        console.log(
          `🍂 [Synapse] Connection closed. Retry #${this.reconnectAttempts} in ${
            Math.round(delay / 1000)
          }s. Outbox: ${this.buffer.length}, dropped: ${this.droppedCount}.`,
        );
        this.reconnectTimer = setTimeout(
          () => this.connect(),
          delay,
        ) as unknown as number;
      };
    } catch (e) {
      console.error(`🍂 [Synapse] Failed to initialize WebSocket:`, e);
    }
  }

  public emitCompost(receipt: MitosisReceipt) {
    // Map MitosisReceipt to Liquid's CompostWitnessedClaim
    const payload = {
      // FNV-1a hash of receipt string to represent the agent ID
      agent_id: this.fastHash(receipt.receiptHash),
      genome: receipt.parent.genome,
      phase: receipt.parent.phase,
      energy_at_death: receipt.metabolicCost,
      epoch: receipt.tick,
    };

    const msg = {
      type: "COMPOST_WITNESSED",
      payload: payload,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      this.sentCount++;
      return;
    }

    // Buffer it so it's not lost if Liquid temporarily disconnects.
    this.buffer.push(msg);
    if (this.buffer.length > COMPOST_BUFFER_LIMIT) {
      this.buffer.shift(); // oldest out — bounded memory
      this.droppedCount++;
      // Log on the first drop and then every 100th, so the loss is visible
      // without becoming the thing that floods the console.
      if (this.droppedCount === 1 || this.droppedCount % 100 === 0) {
        console.warn(
          `🍂 [Synapse] Outbox full (${COMPOST_BUFFER_LIMIT}) — dropped ${this.droppedCount} compost event(s). Liquid has been unreachable at ${this.targetUrl}.`,
        );
      }
    }
  }

  private fastHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
