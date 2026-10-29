import type { PartyErrorCode } from './contracts.js';

export class PartyError extends Error {
  constructor(
    readonly code: PartyErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'PartyError';
  }
}

/** Коды закрытия, при которых переподключаться не нужно (штатный выход / кик сервера). */
export function isFinalClose(code: number): boolean {
  return code === 1000 || (code >= 4000 && code <= 4005);
}

/** Преобразует ошибку colyseus.js в PartyError. */
export function mapError(e: unknown): PartyError {
  if (e instanceof PartyError) return e;
  const err = e as { code?: unknown; message?: unknown } | null;
  const code = typeof err?.code === 'number' ? err.code : 0;
  const msg = typeof err?.message === 'string' ? err.message : '';
  if (code === 4003 || msg === 'started') return new PartyError('started', msg);
  if (code === 4004 || msg === 'full' || /locked|already full/i.test(msg)) {
    return new PartyError('full', msg);
  }
  if (code === 4006 || msg === 'kicked') return new PartyError('kicked', msg);
  if (code === 4212 || /not found|disposed/i.test(msg)) return new PartyError('not_found', msg);
  return new PartyError('network', msg);
}
