import { h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import { gameConfig, SLUG } from '../shared/config.js';
import type { BluffPublicState } from '../shared/types.js';
import { buildRevealPlan, shownCount, type RevealEntry } from './revealPlan.js';
import {
  avatarEl,
  fontClass,
  listOf,
  nickEl,
  nickOf,
  playersOf,
  questionNodes,
  readMap,
  type BluffCtx,
} from './util.js';

/** Пауза между показами вариантов. */
export const REVEAL_STEP_MS = 1000;

/** Раунд, по которому аналитика уже отправлена (переживает пересоздание экрана при реконнекте). */
let trackedKey = '';

/** Экран roundEnd: варианты по одному (выдумки по возрастанию голосов, правда последней). */
export function mountRoundEnd(container: HTMLElement, ctx: BluffCtx): GameView<BluffPublicState> {
  const { t, me } = ctx;
  const title = h('div', { class: 'bluff-reveal__q' });
  const rows = h('div', { class: 'bluff-reveal__rows' });
  const mine = h('div', { class: 'bluff-reveal__mine' });
  const scores = h('div', { class: 'bluff-reveal__scores' });
  const root = h('div', { class: 'bluff-reveal' }, [title, rows, mine, scores]);
  container.append(root);

  let sig = '';
  let plan: RevealEntry[] = [];
  let els: HTMLElement[] = [];
  let shown = 0;
  let last: BluffPublicState | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  function entryEl(state: BluffPublicState, e: RevealEntry): HTMLElement {
    const names = e.authors.map((id) => nickOf(state, id)).join(', ');
    const stamp =
      e.kind === 'truth'
        ? t('bluff.reveal.truth', { n: e.points })
        : e.kind === 'lie'
          ? t('bluff.reveal.lie', { names, n: e.points })
          : t('bluff.reveal.house');
    const voters = h('div', { class: 'bluff-entry__voters' });
    for (const id of e.voters) {
      const p = state.players.get(id);
      if (p) voters.append(avatarEl(p));
    }
    if (e.voters.length === 0) {
      voters.append(h('span', { class: 'bluff-entry__none' }, t('bluff.reveal.nobody')));
    }
    return h('div', { class: `bluff-entry bluff-entry--${e.kind}` }, [
      h('div', { class: `bluff-entry__text${fontClass(ctx.cosmetics().skin)}` }, e.text),
      voters,
      h('div', { class: 'bluff-entry__stamp' }, stamp),
    ]);
  }

  function renderScores(state: BluffPublicState): void {
    scores.replaceChildren();
    const sorted = playersOf(state).sort((a, b) => b.score - a.score);
    for (const p of sorted) {
      scores.append(
        h('div', { class: `bluff-score${p.id === me ? ' bluff-score--me' : ''}` }, [
          avatarEl(p),
          nickEl(p, 'bluff-score__nick'),
          h('span', { class: 'bluff-score__plus' }, p.roundScore > 0 ? `+${p.roundScore}` : ''),
          h('span', { class: 'bluff-score__total' }, String(p.score)),
        ]),
      );
    }
  }

  function applyShown(): void {
    if (!last) return;
    const elapsed = ctx.client.serverNow() - (last.phaseEndsAt - gameConfig.roundEndMs);
    const next = shownCount(plan.length, elapsed, REVEAL_STEP_MS);
    if (next !== shown) {
      shown = next;
      els.forEach((el, i) => (el.hidden = i >= shown));
    }
    const done = shown >= plan.length;
    mine.hidden = !done;
    scores.hidden = !done;
    if (done && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function track(state: BluffPublicState, lies: Map<string, string>): void {
    const key = `${state.code}|${state.round}`;
    const own = lies.get(me);
    if (key === trackedKey || !own || !state.truthId) return;
    trackedKey = key;
    const fooled = plan.find((e) => e.id === own)?.voters.length ?? 0;
    ctx.track('lie_fooled_count', {
      game: SLUG,
      round: state.round,
      fooled,
      players: state.players.size,
    });
  }

  return {
    update(state) {
      last = state;
      const lies = readMap(state.lies);
      const votes = readMap(state.votes);
      const next = [
        state.round,
        state.truthId,
        state.options.map((o) => `${o.id}:${o.text}`).join('|'),
        [...lies].join(';'),
        [...votes].join(';'),
        playersOf(state)
          .map((p) => `${p.id}:${p.nick}:${p.roundScore}:${p.score}`)
          .join(','),
      ].join('#');
      if (next !== sig) {
        sig = next;
        plan = state.truthId
          ? buildRevealPlan(listOf(state.options), state.truthId, lies, votes)
          : [];
        title.replaceChildren(...questionNodes(state.question));
        els = plan.map((e) => entryEl(state, e));
        rows.replaceChildren(...els);
        shown = -1;
        const myRound = state.players.get(me)?.roundScore ?? 0;
        mine.textContent = t('bluff.reveal.you', { n: myRound });
        renderScores(state);
        track(state, lies);
      }
      applyShown();
      if (timer === undefined && shown < plan.length) timer = setInterval(applyShown, 250);
    },
    destroy() {
      if (timer !== undefined) clearInterval(timer);
      root.remove();
    },
  };
}
