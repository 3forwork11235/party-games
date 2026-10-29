import { TokenBucket } from '../shared/rateLimit.js';
import type { RateLimitConfig } from '../shared/contracts.js';

const VIOLATION_DECAY_MS = 5000;

/** Лимиты и счётчик нарушений одного клиента. */
export class ClientLimiter {
  private readonly general: TokenBucket;
  private readonly chat: TokenBucket;
  private violations = 0;
  private lastViolation = 0;

  constructor(private readonly cfg: RateLimitConfig) {
    this.general = new TokenBucket(cfg.capacity, cfg.refillPerSec);
    this.chat = new TokenBucket(cfg.chatCapacity, cfg.chatRefillPerSec);
  }

  /** ok — сообщение принято; kick — нарушений больше maxViolations. */
  check(now: number, isChat: boolean): { ok: boolean; kick: boolean } {
    const ok = this.general.take(now) && (!isChat || this.chat.take(now));
    if (ok) return { ok, kick: false };
    if (now - this.lastViolation > VIOLATION_DECAY_MS) this.violations = 0;
    this.lastViolation = now;
    this.violations++;
    return { ok, kick: this.violations > this.cfg.maxViolations };
  }
}
