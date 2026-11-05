import { clear, h } from '@party/ui';
import type { IPlayer } from '@party/core/shared';
import type { GameContext, GameView } from '@party/ui/app-shell';
import type { Rule } from '../shared/config.js';
import { isRule } from '../shared/config.js';
import type { CrowPublicState } from '../shared/types.js';
import { questionOf } from './questions.js';
import { playerChip, readCounts, ruleEmoji, playersOf } from './util.js';

/** Пауза между вариантами при раскрытии. */
const STEP_MS = 600;

function topIds(counts: Map<string, number>): { ids: string[]; top: number } {
  const top = Math.max(0, ...counts.values());
  return { top, ids: top > 0 ? [...counts].filter(([, n]) => n === top).map(([id]) => id) : [] };
}

/** Экран roundEnd: варианты по возрастанию числа выборов, «+N», итог раунда и (в финале) звания. */
export function mountRoundEnd(
  container: HTMLElement,
  ctx: GameContext<CrowPublicState>,
): GameView<CrowPublicState> {
  const { t } = ctx;
  const chip = h('div', { class: 'crow-chip' });
  const question = h('div', { class: 'crow-question crow-question--small' });
  const list = h('div', { class: 'crow-rev' });
  const summary = h('div', { class: 'crow-summary' });
  const titles = h('div', { class: 'crow-titles' });
  const root = h('div', { class: 'crow-reveal' }, [chip, question, list, summary, titles]);
  container.append(root);

  let sig = '';

  const names = (ids: string[], byId: Map<string, IPlayer>): string =>
    ids
      .map((id) => byId.get(id)?.nick ?? '')
      .filter(Boolean)
      .join(', ');

  function render(state: CrowPublicState): void {
    const rawRule = state.rules[state.round - 1];
    const rule: Rule = isRule(rawRule) ? rawRule : 'flock';
    const isFinal = state.round >= state.totalRounds;
    const players = playersOf(state);
    const byId = new Map(players.map((p) => [p.id, p]));
    const picks = readCounts(state.picks);
    const q = questionOf(state.questionId);

    clear(chip);
    chip.append(
      h('span', { class: 'crow-chip__emoji' }, ruleEmoji(rule)),
      h('span', { class: 'crow-chip__name' }, t(`crow.rule.${rule}.name`)),
    );
    if (isFinal) chip.append(h('span', { class: 'crow-chip__x2' }, '×2'));
    question.textContent = q?.q ?? '';

    const groups = new Map<number, string[]>();
    for (const [id, opt] of picks) groups.set(opt, [...(groups.get(opt) ?? []), id]);
    const order = [...state.options].sort(
      (a, b) => (groups.get(a)?.length ?? 0) - (groups.get(b)?.length ?? 0),
    );

    clear(list);
    order.forEach((idx, i) => {
      const ids = groups.get(idx) ?? [];
      const o = q?.options[idx];
      const gained = ids.filter((id) => (byId.get(id)?.roundScore ?? 0) > 0);
      const tag =
        gained.length === 0
          ? ''
          : rule === 'pair'
            ? t('crow.tagPair')
            : rule === 'odd'
              ? t('crow.tagOdd')
              : '';
      const row = h(
        'div',
        { class: `crow-rev__row${gained.length ? ' crow-rev__row--win' : ''}` },
        [
          h('span', { class: 'crow-rev__emoji' }, o?.emoji ?? ''),
          h('span', { class: 'crow-rev__label' }, o?.label ?? ''),
          h(
            'span',
            { class: 'crow-rev__who' },
            ids.flatMap((id) => {
              const p = byId.get(id);
              if (!p) return [];
              const pts = p.roundScore;
              return [
                playerChip(p, pts > 0 ? h('span', { class: 'crow-rev__pts' }, `+${pts}`) : ''),
              ];
            }),
          ),
          tag ? h('span', { class: 'crow-rev__tag' }, tag) : '',
        ],
      );
      row.style.setProperty('--d', `${i * STEP_MS}ms`);
      list.append(row);
    });
    const endDelay = `${order.length * STEP_MS}ms`;

    const winners = players.filter((p) => picks.has(p.id) && p.roundScore > 0);
    const key = rule === 'odd' ? 'summaryOdd' : rule === 'pair' ? 'summaryPair' : 'summaryFlock';
    summary.textContent =
      winners.length > 0
        ? t(`crow.${key}`, {
            names: names(
              winners.map((p) => p.id),
              byId,
            ),
          })
        : t('crow.noPoints');
    summary.style.setProperty('--d', endDelay);

    clear(titles);
    titles.style.setProperty('--d', endDelay);
    if (isFinal) {
      const lone = topIds(readCounts(state.lone));
      if (lone.top > 0) {
        titles.append(h('div', {}, t('crow.titleOdd', { names: names(lone.ids, byId) })));
      }
      const soul = topIds(readCounts(state.matches));
      if (soul.top > 0) {
        titles.append(h('div', {}, t('crow.titleFlock', { names: names(soul.ids, byId) })));
      }
    }
  }

  return {
    update(state) {
      const picks = [...readCounts(state.picks)].sort().join(';');
      const scores = playersOf(state)
        .map((p) => `${p.id}:${p.roundScore}:${p.nick}`)
        .join(',');
      const s = `${state.round}|${state.questionId}|${picks}|${scores}`;
      if (s === sig) return;
      sig = s;
      render(state);
    },
    destroy() {
      root.remove();
    },
  };
}
