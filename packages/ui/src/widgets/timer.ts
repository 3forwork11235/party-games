import { h } from '../dom.js';
import type { Component } from '../types.js';

export interface Timer extends Component {
  /** endsAt — серверное время окончания, serverNow — текущее серверное время. 0 — скрыть. */
  update(endsAt: number, serverNow: () => number): void;
}

/** Остаток времени: секунды (`59`) или `m:ss` (`5:00`) при остатке от 60 с. */
export function formatLeft(ms: number): string {
  const sec = Math.ceil(Math.max(0, ms) / 1000);
  if (sec < 60) return String(sec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function createTimer(): Timer {
  const bar = h('div', { class: 'p-timer__bar' });
  const text = h('span', { class: 'p-timer__text' });
  const el = h('div', { class: 'p-timer' }, [bar, text]);
  let raf = 0;

  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function update(endsAt: number, serverNow: () => number): void {
    stop();
    el.hidden = endsAt === 0;
    if (endsAt === 0) return;
    const total = Math.max(1, endsAt - serverNow());
    const tick = (): void => {
      const left = Math.max(0, endsAt - serverNow());
      bar.style.width = `${Math.min(100, (left / total) * 100)}%`;
      text.textContent = formatLeft(left);
      raf = left > 0 ? requestAnimationFrame(tick) : 0;
    };
    tick();
  }
  return {
    el,
    update,
    destroy: () => {
      stop();
      el.remove();
    },
  };
}
