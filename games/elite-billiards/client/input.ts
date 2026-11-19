import { BALL_SPECS, KITCHEN_X, W } from '../shared/table.js';
import type { AimState } from './types.js';
import type { View } from './view.js';

export interface InputDeps {
  canvas: HTMLCanvasElement;
  aim: AimState;
  view: () => View;
  /** Можно ли сейчас целиться (мой ход, aim, round). */
  canAim(): boolean;
  cueInHand(): boolean;
  onChange(): void;
}

const CUE_R = BALL_SPECS.cue.r;

/** Pointer-ввод по столу: направление прицела или перетаскивание битка с руки. */
export function createInput(d: InputDeps): () => void {
  const { canvas, aim } = d;
  let drag: 'none' | 'aim' | 'cue' = 'none';

  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const setAim = (px: number, py: number): void => {
    const p = d.view().toTable(px, py);
    const dx = p.x - aim.cueX;
    const dy = p.y - aim.cueY;
    const l = Math.hypot(dx, dy);
    if (l < 0.01) return;
    aim.dx = dx / l;
    aim.dy = dy / l;
    d.onChange();
  };

  const moveCue = (px: number, py: number): void => {
    const p = d.view().toTable(px, py);
    aim.cueX = Math.min(KITCHEN_X, Math.max(CUE_R, p.x));
    aim.cueY = Math.min(W - CUE_R, Math.max(CUE_R, p.y));
    d.onChange();
  };

  const down = (e: PointerEvent): void => {
    if (!d.canAim()) return;
    const l = local(e);
    const view = d.view();
    if (d.cueInHand()) {
      const c = view.toScreen(aim.cueX, aim.cueY);
      if (Math.hypot(l.x - c.x, l.y - c.y) <= 2 * CUE_R * view.scale) {
        drag = 'cue';
        canvas.setPointerCapture(e.pointerId);
        moveCue(l.x, l.y);
        return;
      }
    }
    drag = 'aim';
    canvas.setPointerCapture(e.pointerId);
    setAim(l.x, l.y);
  };
  const move = (e: PointerEvent): void => {
    if (drag === 'none' || !d.canAim()) return;
    const l = local(e);
    if (drag === 'cue') moveCue(l.x, l.y);
    else setAim(l.x, l.y);
  };
  const up = (): void => {
    drag = 'none';
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}
