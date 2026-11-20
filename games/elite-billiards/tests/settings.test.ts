import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../client/settings.js';

describe('normalizeSettings', () => {
  it('мусор -> дефолты', () => {
    for (const raw of [
      null,
      undefined,
      5,
      'x',
      [],
      { volume: 'loud', aimHint: 'zzz', soundOn: 1 },
    ]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });
  it('громкость клампится', () => {
    expect(normalizeSettings({ volume: 5 }).volume).toBe(1);
    expect(normalizeSettings({ volume: -2 }).volume).toBe(0);
    expect(normalizeSettings({ volume: NaN }).volume).toBe(DEFAULT_SETTINGS.volume);
  });
  it('валидные значения сохраняются', () => {
    const s = { soundOn: false, volume: 0.3, aimHint: 'line', vibration: false, handoff: false };
    expect(normalizeSettings(s)).toEqual(s);
  });
});
