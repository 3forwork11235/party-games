import { h } from '@party/ui';

const SPARKS = ['🎆', '🎇', '✨', '🎉'];
const SPARK_COUNT = 16;

/**
 * Косметическая анимация раскрытия поверх слоя `layer` (position:absolute, inset:0).
 * Разворачивается за `revealMs` до появления лидера и/или в момент раскрытия. Возвращает очистку.
 */
export function playEffect(
  effect: string | undefined,
  layer: HTMLElement,
  revealMs: number,
): () => void {
  let timer = 0;
  layer.textContent = '';
  if (effect === 'reveal_drumroll') {
    const drum = h('div', { class: 'wou-fx wou-fx--drum' }, '🥁');
    layer.append(drum);
    timer = window.setTimeout(() => drum.remove(), revealMs);
  } else if (effect === 'reveal_spotlight') {
    const dark = h('div', { class: 'wou-fx wou-fx--dark' });
    dark.style.setProperty('--reveal', `${revealMs}ms`);
    layer.append(dark);
  } else if (effect === 'reveal_fireworks') {
    timer = window.setTimeout(() => {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const s = h('span', { class: 'wou-fx wou-fx--spark' }, SPARKS[i % SPARKS.length]);
        s.style.left = `${5 + Math.random() * 90}%`;
        s.style.top = `${5 + Math.random() * 80}%`;
        s.style.animationDelay = `${Math.random() * 900}ms`;
        layer.append(s);
      }
    }, revealMs);
  }
  return () => {
    window.clearTimeout(timer);
    layer.textContent = '';
  };
}
