import { clear, h } from '@party/ui';
import type { GameView } from '@party/ui/app-shell';
import type { SpyPublicState } from '../shared/types.js';
import { locationEmoji, locationName } from './locations.js';
import { revealEvents } from './stats.js';
import { avatarEl, nickEl, nickOf, playersOf, readMap, type SpyCtx } from './util.js';

const OUTCOMES = ['spy_guessed', 'spy_wrong', 'spy_caught', 'spy_escaped'];
const SPY_WINS = new Set(['spy_guessed', 'spy_escaped']);

/** Раунд, по которому аналитика уже отправлена (переживает пересоздание экрана при реконнекте). */
let trackedKey = '';

/** Экран roundEnd: шпион, локация, исход, догадка, кто за кого голосовал, очки раунда. */
export function mountRoundEnd(container: HTMLElement, ctx: SpyCtx): GameView<SpyPublicState> {
  const { t, me } = ctx;
  const spyBox = h('div', { class: 'spy-reveal__spy' });
  const place = h('div', { class: 'spy-reveal__place' });
  const outcome = h('div', { class: 'spy-reveal__outcome' });
  const notes = h('div', { class: 'spy-reveal__notes' });
  const rows = h('div', { class: 'spy-reveal__rows' });
  const root = h('div', { class: 'spy-reveal' }, [spyBox, place, outcome, notes, rows]);
  container.append(root);

  let sig = '';

  function renderTop(state: SpyPublicState): void {
    clear(spyBox);
    const spy = state.players.get(state.spyId);
    if (spy) {
      spyBox.append(
        h('div', { class: 'spy-reveal__label' }, t('spy.reveal.spyWas')),
        h('div', { class: 'spy-reveal__who' }, [avatarEl(spy), nickEl(spy, 'spy-reveal__nick')]),
      );
    }
    clear(place);
    if (state.locationId) {
      place.append(
        h('span', { class: 'spy-reveal__emoji' }, locationEmoji(state.locationId)),
        h('span', { class: 'spy-reveal__loc' }, locationName(state.locationId)),
      );
    }
    const known = OUTCOMES.includes(state.outcome);
    outcome.hidden = !known;
    outcome.className = `spy-reveal__outcome ${SPY_WINS.has(state.outcome) ? 'spy-reveal__outcome--spy' : 'spy-reveal__outcome--crew'}`;
    outcome.textContent = known ? t(`spy.reveal.outcome.${state.outcome}`) : '';
  }

  function renderNotes(state: SpyPublicState, voted: boolean): void {
    clear(notes);
    if (state.guessId) {
      const ok = state.guessId === state.locationId;
      notes.append(
        h(
          'div',
          { class: `spy-reveal__note ${ok ? 'spy-reveal__note--ok' : 'spy-reveal__note--bad'}` },
          `${ok ? '✅' : '❌'} ${t('spy.reveal.guess', { name: locationName(state.guessId) })}`,
        ),
      );
    }
    if (state.accusedId) {
      notes.append(
        h(
          'div',
          { class: 'spy-reveal__note' },
          t('spy.reveal.accused', { name: nickOf(state, state.accusedId) }),
        ),
      );
    } else if (voted && !state.guessId) {
      notes.append(h('div', { class: 'spy-reveal__note' }, t('spy.reveal.noAccused')));
    }
  }

  function renderRows(state: SpyPublicState, votes: Map<string, string>): void {
    clear(rows);
    if (votes.size > 0) {
      rows.append(h('div', { class: 'spy-reveal__label' }, t('spy.reveal.votes')));
    }
    for (const p of playersOf(state)) {
      const target = votes.get(p.id);
      const top = h('div', { class: 'spy-row__top' }, [
        avatarEl(p),
        nickEl(p, 'spy-row__nick'),
        p.id === state.spyId ? h('span', { 'aria-hidden': 'true' }, '🕵️') : null,
        h('span', { class: 'spy-row__plus' }, p.roundScore > 0 ? `+${p.roundScore}` : ''),
        h('span', { class: 'spy-row__total' }, String(p.score)),
      ]);
      const row = h('div', { class: `spy-row${p.id === me ? ' spy-row--me' : ''}` }, top);
      if (votes.size > 0) {
        const line = target
          ? `${t('spy.reveal.voteFor', { name: nickOf(state, target) })}${target === state.spyId ? ' ✅' : ''}`
          : t('spy.reveal.noVote');
        row.append(h('div', { class: 'spy-row__vote' }, line));
      }
      rows.append(row);
    }
  }

  function track(state: SpyPublicState): void {
    const key = `${state.code}|${state.round}`;
    if (key === trackedKey) return;
    const ev = revealEvents(me, {
      round: state.round,
      spyId: state.spyId,
      locationId: state.locationId,
      accusedId: state.accusedId,
      guessId: state.guessId,
      outcome: state.outcome,
      players: state.players.size,
    });
    if (!ev.guessed && !ev.won) return;
    trackedKey = key;
    if (ev.guessed) ctx.track('location_guessed', ev.guessed);
    if (ev.won) ctx.track('spy_won', ev.won);
  }

  return {
    update(state) {
      const votes = readMap(state.votes);
      const scores = playersOf(state)
        .map((p) => `${p.id}:${p.nick}:${p.roundScore}:${p.score}`)
        .join(',');
      const next = [
        state.round,
        state.spyId,
        state.locationId,
        state.accusedId,
        state.guessId,
        state.outcome,
        [...votes].join(';'),
        scores,
      ].join('|');
      if (next === sig) return;
      sig = next;
      renderTop(state);
      renderNotes(state, votes.size > 0);
      renderRows(state, votes);
      track(state);
    },
    destroy() {
      root.remove();
    },
  };
}
