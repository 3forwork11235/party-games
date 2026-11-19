import { h } from '@party/ui';
import { MAX_TIP_OFFSET } from '../shared/physics/index.js';
import type { AimState, BilliardsCtx } from './types.js';

export const NUDGE_RAD = (0.15 * Math.PI) / 180;

export interface Panel {
  el: HTMLElement;
  /** Показать панель и (не)разрешить удар. */
  setState(show: boolean, canShoot: boolean): void;
  /** Обновить элементы по aim (после программных изменений). */
  sync(): void;
  destroy(): void;
}

export interface PanelHandlers {
  onChange(): void;
  onNudge(sign: number): void;
  onShoot(): void;
}

/** DOM-панель управления: сила, точка удара, доводка, «Удар». */
export function createPanel(ctx: BilliardsCtx, aim: AimState, on: PanelHandlers): Panel {
  const { t } = ctx;
  const cleanups: Array<() => void> = [];

  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    class: 'eb-power',
    'aria-label': t('billiards.power'),
  });
  slider.value = String(Math.round(aim.power * 100));
  const powerVal = h('span', { class: 'eb-power__val' });
  slider.addEventListener('input', () => {
    aim.power = Number(slider.value) / 100;
    sync();
    on.onChange();
  });

  const dot = h('div', { class: 'eb-tip__dot' });
  const tip = h('div', { class: 'eb-tip', 'aria-label': t('billiards.tip') }, [
    h('div', { class: 'eb-tip__limit' }),
    dot,
  ]);
  let tipDrag = false;
  const setTip = (e: PointerEvent): void => {
    const r = tip.getBoundingClientRect();
    const rad = r.width / 2;
    let sx = (e.clientX - (r.left + rad)) / rad;
    let sy = -(e.clientY - (r.top + rad)) / rad;
    const l = Math.hypot(sx, sy);
    if (l > MAX_TIP_OFFSET) {
      sx = (sx / l) * MAX_TIP_OFFSET;
      sy = (sy / l) * MAX_TIP_OFFSET;
    }
    aim.spinX = sx;
    aim.spinY = sy;
    sync();
    on.onChange();
  };
  tip.addEventListener('pointerdown', (e) => {
    tipDrag = true;
    tip.setPointerCapture(e.pointerId);
    setTip(e);
  });
  tip.addEventListener('pointermove', (e) => {
    if (tipDrag) setTip(e);
  });
  const tipEnd = (): void => {
    tipDrag = false;
  };
  tip.addEventListener('pointerup', tipEnd);
  tip.addEventListener('pointercancel', tipEnd);
  const tipReset = h('button', { type: 'button', class: 'eb-btn eb-btn--small' }, '⊙');
  tipReset.addEventListener('click', () => {
    aim.spinX = 0;
    aim.spinY = 0;
    sync();
    on.onChange();
  });

  const nudgeBtn = (label: string, sign: number, aria: string): HTMLButtonElement => {
    const b = h(
      'button',
      { type: 'button', class: 'eb-btn eb-btn--nudge', 'aria-label': aria },
      label,
    );
    let delay = 0;
    let rep = 0;
    const stop = (): void => {
      clearTimeout(delay);
      clearInterval(rep);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
      on.onNudge(sign);
      delay = window.setTimeout(() => {
        rep = window.setInterval(() => on.onNudge(sign), 45);
      }, 350);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    cleanups.push(stop);
    return b;
  };

  const shoot = h(
    'button',
    { type: 'button', class: 'eb-btn eb-btn--shoot' },
    t('billiards.shoot'),
  );
  shoot.addEventListener('click', () => on.onShoot());

  const el = h('div', { class: 'eb-panel', hidden: true }, [
    h('div', { class: 'eb-panel__tip' }, [tip, tipReset]),
    h('div', { class: 'eb-panel__main' }, [
      h('div', { class: 'eb-panel__power' }, [
        h('span', {}, t('billiards.power')),
        slider,
        powerVal,
      ]),
      h('div', { class: 'eb-panel__row' }, [
        nudgeBtn('◀', 1, t('billiards.nudgeLeft')),
        shoot,
        nudgeBtn('▶', -1, t('billiards.nudgeRight')),
      ]),
    ]),
  ]);

  function sync(): void {
    // Круг = шар (радиус 100%), точка в долях радиуса.
    powerVal.textContent = `${Math.round(aim.power * 100)}%`;
    slider.value = String(Math.round(aim.power * 100));
    dot.style.left = `${50 + aim.spinX * 50}%`;
    dot.style.top = `${50 - aim.spinY * 50}%`;
  }
  sync();

  return {
    el,
    setState(show, canShoot) {
      el.hidden = !show;
      shoot.disabled = !canShoot;
    },
    sync,
    destroy() {
      for (const c of cleanups) c();
      el.remove();
    },
  };
}
