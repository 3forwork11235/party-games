import type { GameContext, GameView } from '@party/ui/app-shell';
import { MSG_TAP } from '../shared/messages.js';
import type { ClickerPublicState } from '../shared/types.js';
import { drawBars } from './bars.js';

/** Игровой экран: полоски прогресса (canvas) сверху, круглая кнопка Tap снизу. */
export function mountGame(
  container: HTMLElement,
  ctx: GameContext<ClickerPublicState>,
): GameView<ClickerPublicState> {
  const { t, me } = ctx;
  const canvas = document.createElement('canvas');
  canvas.className = 'p-no-context';
  canvas.style.cssText = 'width:100%;height:40vh;min-height:140px;flex:none';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'text-align:center;font-size:64px;font-weight:700;min-height:76px';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'p-no-context';
  button.textContent = t('clicker.tap');
  button.style.cssText =
    'width:180px;height:180px;border-radius:50%;border:0;margin:0 auto;font-size:32px;' +
    'font-weight:700;color:#fff;background:var(--accent);touch-action:manipulation;' +
    'user-select:none;-webkit-user-select:none';
  const finished = document.createElement('div');
  finished.className = 'p-title';
  finished.style.cssText = 'text-align:center;min-height:28px';
  container.append(canvas, overlay, button, finished);

  let last: ClickerPublicState | null = null;
  let myClicks = 0;
  let lastRound = -1;
  let raf = 0;

  const redraw = (): void => {
    if (last) drawBars(canvas, last, me, myClicks);
  };

  const tickCountdown = (): void => {
    if (!last || last.phase !== 'countdown') return;
    const left = Math.max(0, last.phaseEndsAt - ctx.client.serverNow());
    overlay.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    raf = requestAnimationFrame(tickCountdown);
  };

  const onTap = (e: PointerEvent): void => {
    e.preventDefault();
    if (!last || last.phase !== 'round' || myClicks >= last.target) return;
    myClicks++;
    ctx.client.sendGame(MSG_TAP, {});
    navigator.vibrate?.(5);
    redraw();
  };
  button.addEventListener('pointerdown', onTap);

  return {
    update(state) {
      const prev = last;
      last = state;
      if (state.round !== lastRound || state.phase === 'countdown') {
        lastRound = state.round;
        myClicks = 0;
      } else {
        myClicks = state.clicks.get(me) ?? 0;
      }
      button.disabled = state.phase !== 'round' || myClicks >= state.target;
      button.style.opacity = button.disabled ? '0.5' : '1';
      if (state.phase === 'countdown' && prev?.phase !== 'countdown') {
        cancelAnimationFrame(raf);
        tickCountdown();
      } else if (state.phase !== 'countdown' && prev?.phase === 'countdown') {
        overlay.textContent = t('clicker.go');
      } else if (state.phase !== 'countdown' && state.phase !== 'round') {
        overlay.textContent = '';
      }
      const place = state.finishOrder.indexOf(me) + 1;
      finished.textContent = place > 0 ? t('clicker.finished', { place }) : t('clicker.rules');
      redraw();
    },
    destroy() {
      cancelAnimationFrame(raf);
      button.removeEventListener('pointerdown', onTap);
      canvas.remove();
      overlay.remove();
      button.remove();
      finished.remove();
    },
  };
}
