import { h } from '../dom.js';
import type { Component } from '../types.js';

export interface Timer extends Component {
  /** endsAt — серверное время окончания, serverNow — текущее серверное время. 0 — скрыть. */
  update(endsAt: number, serverNow: () => number): void;
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
      text.textContent = String(Math.ceil(left / 1000));
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
