/** Token bucket. Время передаётся снаружи (мс), чтобы код был детерминированным. */
export class TokenBucket {
  private tokens: number;
  private last: number | null = null;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  take(now: number): boolean {
    if (this.last !== null) {
      const dt = Math.max(0, now - this.last) / 1000;
      this.tokens = Math.min(this.capacity, this.tokens + dt * this.refillPerSec);
    }
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
