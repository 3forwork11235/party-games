// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adapterSink, createTracker, multiSink } from '../src/index.js';
import type { AnalyticsSink } from '../src/index.js';

function makeSink(): { sink: AnalyticsSink; calls: [string, Record<string, unknown>][] } {
  const calls: [string, Record<string, unknown>][] = [];
  return { sink: { send: (e, p) => void calls.push([e, p]) }, calls };
}

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('track', () => {
  it('forwards typed events to the sink', () => {
    const { sink, calls } = makeSink();
    const tracker = createTracker({ sink });
    tracker.track('game_start', { game: 'demo', players: 3 });
    expect(calls).toEqual([['game_start', { game: 'demo', players: 3 }]]);
  });

  it('rejects wrong params at compile time', () => {
    const { sink } = makeSink();
    const tracker = createTracker({ sink });
    // @ts-expect-error players must be a number
    tracker.track('game_start', { game: 'demo', players: '3' });
    // @ts-expect-error missing params
    tracker.track('ad_rewarded', {});
    // @ts-expect-error unknown event
    tracker.track('nope', {});
    expect(true).toBe(true);
  });
});

describe('session_length', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends once on hide and only the increment after returning', () => {
    const { sink, calls } = makeSink();
    const tracker = createTracker({ sink });
    tracker.startSession();
    tracker.startSession();

    vi.advanceTimersByTime(10_000);
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    expect(calls).toEqual([['session_length', { seconds: 10 }]]);

    vi.advanceTimersByTime(60_000); // в фоне — не считается
    setVisibility('visible');
    vi.advanceTimersByTime(5_000);
    setVisibility('hidden');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(['session_length', { seconds: 5 }]);
  });
});

describe('sinks', () => {
  it('adapterSink forwards to adapter.analytics', () => {
    const analytics = vi.fn();
    adapterSink({ analytics }).send('x', { a: 1 });
    expect(analytics).toHaveBeenCalledWith('x', { a: 1 });
  });

  it('multiSink fans out and survives a failing sink', () => {
    const a = makeSink();
    const bad: AnalyticsSink = {
      send: () => {
        throw new Error('boom');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    multiSink(bad, a.sink).send('e', { k: true });
    expect(a.calls).toEqual([['e', { k: true }]]);
    warn.mockRestore();
  });
});
