import { NICK_COLORS } from '@party/core/shared';
import type { ClickerPublicState } from '../shared/types.js';

const FRAME_COLORS: Record<string, string> = {
  none: 'transparent',
  bronze: '#cd7f32',
  silver: '#c0c6d4',
  gold: '#ffc83d',
  neon: '#39ff88',
  rainbow: '#ff5cf0',
};

/** Рисует горизонтальные полоски прогресса всех игроков. Свой счётчик — оптимистичный (myClicks). */
export function drawBars(
  canvas: HTMLCanvasElement,
  state: ClickerPublicState,
  me: string,
  myClicks: number,
): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 200;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const players = Array.from(state.players.values());
  if (players.length === 0) return;
  const rowH = Math.min(44, h / players.length);
  const font = Math.max(11, Math.floor(rowH * 0.42));
  g.textBaseline = 'middle';
  players.forEach((p, i) => {
    const y = i * rowH;
    const isMe = p.id === me;
    const clicks = isMe ? myClicks : (state.clicks.get(p.id) ?? 0);
    const ratio = Math.min(1, clicks / Math.max(1, state.target));
    const barX = rowH + 90;
    const barW = Math.max(10, w - barX - 56);
    const barH = rowH * 0.5;
    const cy = y + rowH / 2;
    g.globalAlpha = p.connected ? 1 : 0.4;
    if (isMe) {
      g.fillStyle = 'rgba(108,123,255,0.18)';
      g.fillRect(0, y + 1, w, rowH - 2);
    }
    g.font = `${font + 4}px sans-serif`;
    g.fillStyle = '#fff';
    g.fillText(p.avatar, 6, cy);
    const frame = FRAME_COLORS[p.frame] ?? 'transparent';
    if (frame !== 'transparent') {
      g.strokeStyle = frame;
      g.lineWidth = 2;
      g.strokeRect(3, y + 3, rowH - 6, rowH - 6);
    }
    g.font = `${font}px sans-serif`;
    g.fillStyle = NICK_COLORS[p.nickColor] ?? '#f2f4fa';
    g.fillText(p.nick.slice(0, 10), rowH + 2, cy, 86);
    g.fillStyle = '#2a3042';
    g.fillRect(barX, cy - barH / 2, barW, barH);
    g.fillStyle = clicks >= state.target ? '#3ddc97' : isMe ? '#6c7bff' : '#8d95ad';
    g.fillRect(barX, cy - barH / 2, barW * ratio, barH);
    g.fillStyle = '#f2f4fa';
    g.textAlign = 'right';
    g.fillText(`${clicks}/${state.target}`, w - 4, cy);
    g.textAlign = 'left';
    g.globalAlpha = 1;
  });
}
