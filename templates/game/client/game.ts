import type { GameContext, GameView } from '@party/ui/app-shell';
import { MSG_TAP } from '../shared/messages.js';
import type { __PASCAL__PublicState } from '../shared/types.js';

/** Монтирует игровое поле в container. Пока — пустой canvas, по нажатию шлёт намерение. */
export function mountGame(
  container: HTMLElement,
  ctx: GameContext<__PASCAL__PublicState>,
): GameView<__PASCAL__PublicState> {
  const canvas = document.createElement('canvas');
  canvas.className = 'p-no-context';
  canvas.style.cssText = 'width:100%;flex:1;min-height:240px;touch-action:none';
  container.append(canvas);

  const draw = (taps: number): void => {
    const g = canvas.getContext('2d');
    if (!g) return;
    canvas.width = canvas.clientWidth || 320;
    canvas.height = canvas.clientHeight || 320;
    g.fillStyle = '#1b1f2a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#fff';
    g.font = '48px sans-serif';
    g.textAlign = 'center';
    g.fillText(String(taps), canvas.width / 2, canvas.height / 2);
  };

  const onTap = (e: PointerEvent): void => {
    ctx.client.sendGame(MSG_TAP, { x: e.offsetX, y: e.offsetY });
  };
  canvas.addEventListener('pointerdown', onTap);

  return {
    update(state) {
      draw(state.taps);
    },
    destroy() {
      canvas.removeEventListener('pointerdown', onTap);
      canvas.remove();
    },
  };
}
