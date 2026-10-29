# TASKS — Кто из нас? (who-of-us)

Формат: `### ID. Название — @game-coder`. Спецификация — SPEC.md. Каждая задача — один агент.
Проверка после каждой задачи: `pnpm --filter <пакет> build && pnpm --filter <пакет> test && pnpm --filter <пакет> lint`.

Сделано архитектором: E1 (maxPlayers ≤ 10, рамки `crown`/`hearts` в `FRAMES` и `FRAME_COLORS`),
E2 (`PartyRoomApi.restartRound()` в `packages/core/src/server/PartyRoom.ts`),
E5 (`pack_selected`, `question_skipped` в `packages/analytics/src/events.ts`).

## Группа 1 — параллельно (файлы не пересекаются)

### P1. App-shell: игровые хуки и монетизация игры (E3 + E4) — @game-coder ✅
Файлы: `packages/ui/src/app-shell/{types,bootstrap,phases,gameScreen,roundEndScreen,shopFlow}.ts`,
`packages/monetization/src/{config,index}.ts`, тесты в `packages/ui/tests/`, `packages/monetization/tests/`,
`packages/core/tests/` (тест `restartRound`).
- `@party/monetization`: `mergeMonetizationConfig(base, override): MonetizationConfig`, где
  `MonetizationOverride = Partial<Record<PlatformId, { interstitial?: Partial<InterstitialRules>; rewarded?: Partial<RewardedRules>; purchasesEnabled?: boolean }>>` (тип — в `config.ts`, не в contracts).
- `StartPartyAppOptions<S>` (все поля необязательны, без них поведение как сейчас):
  - `catalog?: ProductDef[]` — добавляется к `DEFAULT_CATALOG` (дубли id — побеждает игра); единый каталог идёт в shop, cosmetics, shopFlow.
  - `monetization?: MonetizationOverride` — мержится в `DEFAULT_MONETIZATION_CONFIG` для adManager/shop/shopFlow.
  - `mountLobby?: MountGame<S>` — блок в лобби между списком игроков и кнопками «Магазин/Выйти»; `update` на каждый state, `destroy` при уходе из лобби.
  - `mountRoundEnd?: MountGame<S>` — заменяет scoreboard на экране roundEnd (заголовок оставить).
- `GameContext<S>` дополнить:
  - `ads: { canShowRewarded(): boolean; showRewarded(placement: string): Promise<boolean> }` (через adManager);
  - `entitlements(): Entitlements`;
  - `track<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K]): void`;
  - `cosmetics(): Cosmetics` — выбор текущего игрока;
  - `openShop(onClose?: () => void): void` — открывает модалку магазина shopFlow.
- core: тест `restartRound` (в round сдвигает `phaseEndsAt`, вне round — no-op; раунд не кончается по старому таймеру).
- Готово: build/test/lint `@party/ui`, `@party/monetization`, `@party/core` зелёные; `@game/demo-clicker` собирается без изменений.

### G1. Логика игры (shared + server + тесты) — @game-coder ✅
Файлы: `games/who-of-us/shared/*`, `server/*`, `tests/logic.test.ts`, `tests/room.test.ts` (порт 2570). Удалить шаблонный tap.
- `shared/config.ts`: gameConfig по SPEC §3 (3–10, rounds 10, roundMs 20000, roundEndMs 9000); `MAX_SKIPS = 2`, `GUESS_POINTS = 2`.
- `shared/packs.ts`: `PACKS: readonly { id: PackId; free: boolean; size: 60 }[]` — friends, family (free), work, absurd, party; `PackId`, `isPackId()`, `DEFAULT_PACKS = ['friends','family']`.
- `shared/catalog.ts`: `WOU_CATALOG: ProductDef[]` — косметика `frame_crown`('crown'), `frame_hearts`('hearts'), `reveal_drumroll`, `reveal_spotlight`, `reveal_fireworks` (category `effect`, value = id); паки `pack_wou_work|absurd|party` (`pack: { game: 'who-of-us', packId }`) и `pack_wou_all` (бандл, см. ниже); `WOU_MONETIZATION: MonetizationOverride`-совместимый объект `{ web|yandex: { interstitial: { everyNthBreak: 5 } } }` (тип объявить структурно, не импортировать из ещё не готового P1); `ownedPacks(ent: Entitlements): Set<PackId>` — free + купленные; `pack_wou_all` задать как `kind: 'pack', pack: { game: 'who-of-us', packId: 'all' }` и раскрывать `'who-of-us/all'` в три платных пака.
- `shared/scoring.ts`: `tallyVotes(votes: Map<string,{target,guess}>, present: Set<string>): Record<string,number>`, `findLeaders(tally): string[]`, `scoreRound(votes, leaders): Record<string,number>` (+GUESS_POINTS за guess ∈ leaders).
- `shared/deck.ts`: `buildDeck(packs: PackId[], count: number, rnd = Math.random): string[]` — id `"<pack>/<idx>"` без повторов; если вопросов меньше count — сколько есть. `drawReplacement(deck, used, packs, rnd)` для skip.
- `shared/state.ts` `WhoOfUsState`: поля SPEC §4 (`packs`, `questionId`, `voted`, `tally`, `leaders`, `correct`, `leaderCount`, `skipsLeft`); `shared/types.ts` — `WhoOfUsPublicState extends ICoreState` с теми же полями (plain-типы для клиента).
- `shared/messages.ts`: `MSG_PACKS`, `MSG_VOTE`, `MSG_SKIP` + `GameClientMessages`.
- `server/WhoOfUsRoom.ts` по SPEC §4: голоса в приватном Map; `voted` в state; досрочный `endRound()` когда все подключённые проголосовали (в т.ч. после выхода игрока); `onRoundEnd` заполняет tally/leaders/correct/leaderCount; `onRoundStart` очищает их и ставит `questionId = deck[round-1]`; skip — `skipsLeft--`, 1 раз на игрока, новый вопрос, сброс голосов, `this.restartRound()`; packs — только хост в lobby, 1..5 валидных, дубли убрать; пусто → DEFAULT_PACKS.
- Тесты: scoring (пример из SPEC §5, ничья, нет голосов), deck (без повторов, только выбранные паки), комната: полный цикл 3 игроков × 10 раундов, tally пуст в round и заполнен в roundEnd, досрочный конец, skip (лимиты, сброс голосов, таймер), packs только от хоста, 10 игроков входят, 11-й — `full`.
- Готово: `pnpm --filter @game/who-of-us build|test|lint` зелёные.

### C1. Вопросы: friends, family, work — @game-coder ✅
Файлы: `games/who-of-us/content/questions/{friends,family,work}.json`, формат `{ "ru": string[60], "kk": string[60], "en": string[60] }`.
- Ровно 60 на язык в каждом паке, индекс i — один и тот же вопрос на трёх языках. Формулировка «Кто из нас …?» / «Біздің арамыздан кім …?» / «Who of us …?».
- 0+: без оскорблений, внешности, веса, алкоголя, романтики/секса, политики, религии, опасных действий. Шутливо, про поступки и привычки.
- Без дублей внутри пака и между паками C1.

### C2. Вопросы: absurd, party — @game-coder ✅
Файлы: `games/who-of-us/content/questions/{absurd,party}.json`. Требования как в C1. «Вечеринка» — про игры, танцы, караоке, еду, без алкоголя.

### S1. Карточка Яндекс Игр — @game-coder ✅
Файлы: `games/who-of-us/store/{ru,en}.md`: название (≤ 50), короткое описание (≤ 100), полное описание (≤ 1000, как играть 3–10 игроков, комнаты по коду, паки), 5–8 тегов/категорий, возраст 0+, список скриншотов, которые нужно снять (экраны: лобби с паками, вопрос, раскрытие, итоги).

## Группа 2 — после QA группы 1

### G2. Клиент игры — @game-coder ✅
Зависит от P1, G1, C1, C2. Файлы: `games/who-of-us/client/*`, `content/{ru,kk,en}.json`, `tests/content.test.ts`.
- `client/main.ts`: `startPartyApp` с `catalog: WOU_CATALOG`, `monetization: WOU_MONETIZATION`, `mountGame`, `mountLobby`, `mountRoundEnd`.
- `client/questions.ts`: статический импорт 5 json; `questionText(id, lang)` (через `getLanguage()`), fallback en.
- `client/packs.ts` (mountLobby): список 5 паков; хост — чекбоксы, платные без покупки — 🔒 + «Купить» (`ctx.openShop`), после покупки пересчитать `ownedPacks(ctx.entitlements())`; отправка `MSG_PACKS`, `track('pack_selected', { game, packId, paid })` при включении; не-хост видит только выбранные паки.
- `client/game.ts` + `client/vote.ts`: в countdown — «Вопрос N из 10»; в round — вопрос крупно, сетка игроков (аватар, ник, рамка из `FRAME_COLORS`; 2 колонки на портрете, до 5 на десктопе), шаг 1 голос → шаг 2 «Кто наберёт больше всех?» → «Ждём остальных N/M»; кнопка «Пропустить вопрос 📺», только если `skipsLeft > 0 && ctx.ads.canShowRewarded()` и я ещё не пропускал; после награды — `MSG_SKIP` и `track('question_skipped', { game, round, packId })`. При смене `questionId` выбор сбрасывается.
- `client/reveal.ts` (mountRoundEnd): вопрос, столбики голосов растут по очереди (CSS-анимация ~4 с), затем лидер(ы) крупно, «+2» угадавшим. Эффект `ctx.cosmetics().effect` (`reveal_drumroll|spotlight|fireworks`) — отдельная CSS/DOM-анимация в `client/effects.ts`; без эффекта — простая.
- Итоги: строка «звания» не делаем отдельным экраном — показать в последнем раскрытии (раунд 10) «Чаще всех: …» по `leaderCount`.
- `content/{ru,kk,en}.json`: ключи `whoOfUs.*`, названия паков `whoOfUs.pack.<id>`, товары `shop.<productId>`.
- `tests/content.test.ts`: равенство ключей UI-словарей; в каждом из 5 паков 60 непустых строк на ru/kk/en; нет дублей внутри языка.
- Готово: build/test/lint игры; `pnpm build:web who-of-us` проходит; без горизонтального скролла на 360×640 (CSS `min-width:0`, `overflow-wrap:anywhere`).

## Группа 3 — финал (архитектор + game-qa)
- `pnpm build|test|lint`, `pnpm build:web|build:yandex|build:telegram who-of-us`, `pnpm zip:yandex who-of-us`.
- Ручной прогон 3 вкладок на `pnpm dev who-of-us`.
