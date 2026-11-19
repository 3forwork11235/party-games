import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import {
  MSG_AIM,
  MSG_AIM_OF,
  MSG_SHOT,
  MSG_SHOT_PLAYED,
  type AimOfMessage,
  type ShotPlayedMessage,
} from '../shared/messages.js';
import { isValidCuePlacement } from '../shared/rack.js';
import { BALL_SPECS, HEAD_SPOT } from '../shared/table.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createPanel, NUDGE_RAD } from './panel.js';
import { applyTick } from './tick.js';
import { Orientation } from './render/balls.js';
import { renderTableCache } from './render/table.js';
import { Replay } from './replay.js';
import { drawScene, POT_MS, type PotAnim } from './scene.js';
import { Sound } from './sound.js';
import type { AimState, BallMeta, BilliardsCtx, DrawBall } from './types.js';
import { createView, type View } from './view.js';
const AIM_SEND_MS = 125;
const CUE_META: BallMeta = { id: 0, kind: 'cue', value: 0, r: BALL_SPECS.cue.r };
export function mountGame(
  container: HTMLElement,
  ctx: BilliardsCtx,
): GameView<EliteBilliardsPublicState> {
  const { t, me } = ctx;
  const canvas = h('canvas', { class: 'eb-canvas' });
  const stage = h('div', { class: 'eb-stage' }, [canvas]);
  const aim: AimState = {
    dx: 1,
    dy: 0,
    power: 0.5,
    spinX: 0,
    spinY: 0,
    cueX: HEAD_SPOT.x,
    cueY: HEAD_SPOT.y,
  };
  let other: AimOfMessage | null = null;
  let last: EliteBilliardsPublicState | null = null;
  let meta = new Map<number, BallMeta>();
  let view: View = createView(320, 200);
  let cache: HTMLCanvasElement | null = null;
  let dpr = 1;
  let raf = 0;
  let turnKey = '';
  let shotSent = false;
  let sentSig = '';
  let sentAt = 0;
  let panelKey = '';
  let pots: PotAnim[] = [];
  const replay = new Replay();
  const orient = new Orientation();
  const sound = new Sound();
  const g = canvas.getContext('2d');
  const mine = (): boolean =>
    !!last &&
    last.phase === 'round' &&
    last.stage === 'aim' &&
    last.shooterId === me &&
    !replay.active &&
    !shotSent;
  const inHand = (): boolean => !!last?.cueInHand;
  const valid = (): boolean =>
    !inHand() || (!!last && isValidCuePlacement(aim.cueX, aim.cueY, last.balls));

  const hud = createHud(ctx);
  const panel = createPanel(ctx, aim, {
    onChange: () => undefined,
    onNudge(sign) {
      const c = Math.cos(sign * NUDGE_RAD);
      const s = Math.sin(sign * NUDGE_RAD);
      const dx = aim.dx * c - aim.dy * s;
      const dy = aim.dx * s + aim.dy * c;
      const l = Math.hypot(dx, dy) || 1;
      aim.dx = dx / l;
      aim.dy = dy / l;
    },
    onShoot() {
      if (!mine() || !valid()) return;
      shotSent = true;
      const msg: Record<string, number> = {
        dx: aim.dx,
        dy: aim.dy,
        power: aim.power,
        spinX: aim.spinX,
        spinY: aim.spinY,
      };
      if (inHand()) {
        msg.cueX = aim.cueX;
        msg.cueY = aim.cueY;
      }
      ctx.client.sendGame(MSG_SHOT, msg);
    },
  });
  const stopInput = createInput({
    canvas,
    aim,
    view: () => view,
    canAim: mine,
    cueInHand: inHand,
    onChange: () => undefined,
  });
  container.append(h('div', { class: 'eb-root' }, [stage, hud.el, panel.el]));

  let panelH = 0;
  const resize = (): void => {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, stage.clientWidth);
    const hh = Math.max(1, stage.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    panelH = panel.el.offsetHeight || panelH; // скрытая панель (чужой ход) — прошлая высота
    view = createView(w, hh, hud.el.offsetHeight, panelH);
    cache = renderTableCache(view, dpr);
  };
  const ro = new ResizeObserver(resize);
  [stage, hud.el, panel.el].forEach((el) => ro.observe(el));
  resize();

  const offPlayed = ctx.client.onGame<ShotPlayedMessage>(MSG_SHOT_PLAYED, (msg) => {
    replay.start(msg, meta, performance.now(), last?.shotNo ?? 0);
    other = null;
    sound.strike(msg.power);
  });
  const offAim = ctx.client.onGame<AimOfMessage>(MSG_AIM_OF, (msg) => {
    if (msg.shooterId !== me) other = msg;
  });

  const newTurn = (s: EliteBilliardsPublicState): void => {
    shotSent = false;
    sentSig = '';
    if (s.shooterId !== me || s.stage !== 'aim') return;
    const cue = s.balls.find((b) => b.id === 0);
    if (s.cueInHand || !cue) {
      aim.cueX = HEAD_SPOT.x;
      aim.cueY = HEAD_SPOT.y;
    } else {
      aim.cueX = cue.x;
      aim.cueY = cue.y;
    }
    let best = Infinity;
    for (const b of s.balls) {
      if (b.id === 0 || b.potted) continue;
      const d = Math.hypot(b.x - aim.cueX, b.y - aim.cueY);
      if (d < best && d > 0.01) {
        best = d;
        aim.dx = (b.x - aim.cueX) / d;
        aim.dy = (b.y - aim.cueY) / d;
      }
    }
  };

  const hintText = (): string => {
    if (!mine()) return '';
    if (inHand()) return valid() ? t('billiards.hint.hand') : t('billiards.hint.invalid');
    return t('billiards.hint.aim');
  };

  const handPos = (): { x: number; y: number } => {
    if (mine()) return { x: aim.cueX, y: aim.cueY };
    if (other && other.cueX !== undefined && other.cueY !== undefined) {
      return { x: other.cueX, y: other.cueY };
    }
    return { x: HEAD_SPOT.x, y: HEAD_SPOT.y };
  };

  const display = (): DrawBall[] => {
    const out: DrawBall[] = [];
    const src: ReadonlyArray<{ id: number; x: number; y: number }> = replay.active
      ? replay.balls.filter((b) => !b.potted)
      : (last?.balls ?? []).filter((b) => !b.potted);
    for (const b of src) {
      const m = meta.get(b.id) ?? (b.id === 0 ? CUE_META : undefined);
      if (m) out.push({ id: b.id, kind: m.kind, value: m.value, r: m.r, x: b.x, y: b.y });
    }
    if (!replay.active && last?.cueInHand && last.phase === 'round') {
      const p = handPos();
      const cue: DrawBall = { id: 0, kind: 'cue', value: 0, r: CUE_META.r, x: p.x, y: p.y };
      const i = out.findIndex((b) => b.id === 0);
      if (i >= 0) out[i] = cue;
      else out.push(cue);
    }
    return out;
  };

  const runReplay = (now: number): void =>
    applyTick(replay, replay.tick(now), { now, meta, pots, orient, sound });

  const sendAim = (now: number): void => {
    if (!mine() || now - sentAt < AIM_SEND_MS) return;
    const r = (v: number): number => Math.round(v * 1000) / 1000;
    const msg: Record<string, number> = { dx: r(aim.dx), dy: r(aim.dy), power: r(aim.power) };
    if (inHand()) {
      msg.cueX = r(aim.cueX);
      msg.cueY = r(aim.cueY);
    }
    const sig = JSON.stringify(msg);
    if (sig === sentSig) return;
    sentSig = sig;
    sentAt = now;
    ctx.client.sendGame(MSG_AIM, msg);
  };

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    sound.newFrame();
    if (replay.active) runReplay(now);
    pots = pots.filter((p) => now - p.t0 < POT_MS);
    const m = mine();
    const watching =
      !m &&
      !!last &&
      last.phase === 'round' &&
      last.stage === 'aim' &&
      !replay.active &&
      last.shooterId !== me;
    if (m && !inHand()) {
      const cue = last?.balls.find((b) => b.id === 0);
      if (cue) {
        aim.cueX = cue.x;
        aim.cueY = cue.y;
      }
    }
    const shown: AimState | null = m
      ? aim
      : watching && other
        ? { ...aim, dx: other.dx, dy: other.dy, power: other.power }
        : null;
    const ok = valid();
    const key = `${m}|${m && ok}`;
    if (key !== panelKey) {
      panelKey = key;
      panel.setState(m, m && ok);
      hud.setHint(hintText());
    }
    sendAim(now);
    if (g) {
      drawScene({
        g,
        view,
        cache,
        dpr,
        now,
        balls: display(),
        orient,
        pots,
        aim: shown,
        aimAlpha: m ? 1 : 0.45,
        kitchen: m && inHand() ? { valid: ok } : null,
        invalidCue: m && inHand() && !ok,
      });
    }
    hud.tick();
  };
  raf = requestAnimationFrame(frame);

  return {
    update(s) {
      last = s;
      meta = new Map(s.balls.map((b) => [b.id, { id: b.id, kind: b.kind, value: b.value, r: b.r }]));
      if (replay.active) {
        if (s.stage === 'rolling') replay.sawRolling = true;
        const resolved =
          s.phase !== 'round' ||
          (s.stage === 'aim' && (replay.sawRolling || s.shotNo !== replay.startShotNo));
        if (resolved) {
          replay.finish();
          replay.clear();
        }
      }
      const key = `${s.shooterId}|${s.shotNo}|${s.stage}|${s.round}`;
      if (key !== turnKey) {
        turnKey = key;
        newTurn(s);
        if (s.stage !== 'aim') other = null;
      }
      panelKey = '';
      panel.sync();
      hud.update(s);
      hud.setHint(hintText());
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopInput();
      offPlayed();
      offAim();
      sound.destroy();
      panel.destroy();
      hud.destroy();
      container.replaceChildren();
    },
  };
}
