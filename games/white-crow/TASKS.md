# TASKS — Белая ворона (white-crow)

Формат: `### ID. Название — @game-coder`. Спецификация — SPEC.md. Каждая задача — один агент.
Проверка после задачи: `pnpm --filter @game/white-crow build && pnpm --filter @game/white-crow test && pnpm --filter @game/white-crow lint`.
Общие правила: TS strict, без `any`, файлы < 300 строк (дели на модули), ESM-импорты с `.js`, тексты только через i18n.
`pnpm install` не запускать: пакет уже подключён, lockfile обновлён архитектором.

## Группа 1 — параллельно (файлы не пересекаются)

### G1. Логика и сервер — @game-coder
Файлы: `games/white-crow/shared/*`, `games/white-crow/server/*`, `games/white-crow/tests/{logic,room}.test.ts` (порт **2574**). Удалить шаблонный код (`MSG_TAP`, `pointsForTaps`, `taps`, `__PASCAL__`-имена → `Crow`). Образцы: `games/who-of-us/{shared,server,tests}` (колода, паки, тест комнаты), `games/spy/server/*` и `games/bluffopedia/server/*` (settings хоста, `hello`/`you`).
- `shared/config.ts`: `SLUG = 'white-crow'`, `gameConfig` (minPlayers 3, maxPlayers 8, rounds 9, countdownMs 4000, roundMs 20000, roundEndMs 10000), `ROUND_OPTIONS = [6, 9, 12] as const`, `DEFAULT_ROUNDS = 9`, `RULES = ['flock', 'pair', 'odd'] as const`, `type Rule`, `isRule`, `OPTIONS_PER_QUESTION = 6`, `POINTS = { flockPerMatch: 1, pair: 3, odd: 3 } as const`, `FINAL_MULTIPLIER = 2`.
- `shared/packs.ts`: `PackId = 'everyday' | 'fantasy' | 'food' | 'world'`, `PACKS` (`size: 40`; free: everyday, fantasy), `DEFAULT_PACKS = ['everyday', 'fantasy']`, `isPackId`, `parseQuestionId(id): { pack: PackId; index: number } | null`.
- `shared/catalog.ts`: `CROW_CATALOG: ProductDef[]` — скины (category `'skin'`, value = id, `titleKey: 'shop.<id>'`, `preview` — эмодзи): `skin_feather` 🪶 30, `skin_neon` 💡 35, `skin_paper` 📝 30, `skin_gold` 👑 50; паки `pack_crow_food` (food, 50), `pack_crow_world` (world, 50), `pack_crow_all` (`packId: 'all'`, 80). `PEEK_PLACEMENT = 'white-crow_peek'`. `CROW_MONETIZATION = { web: { interstitial: { everyNthBreak: 3 } }, yandex: { interstitial: { everyNthBreak: 3 } } }`. `ownedPacks(ent): Set<PackId>` как в who-of-us.
- `shared/logic.ts` (чистые функции, `rnd = Math.random` последним параметром):
  - `buildRules(rounds, rnd): Rule[]` — блоки по 3 (каждое правило раз в блоке, порядок случайный), на стыке блоков без повтора подряд; длина `rounds` (для не кратных 3 — обрезка).
  - `buildDeck(packs, count, used: ReadonlySet<string>, rnd): string[]` — `count` разных id `"<pack>/<i>"` из выбранных паков; сначала ещё не использованные (`used` — история комнаты), при нехватке — добор из использованных; если всего вопросов меньше `count` — повторы допустимы, длина всегда `count`.
  - `shownCount(players): number` — `clamp(players + 1, 4, 6)`.
  - `pickShown(players, rnd): number[]` — `shownCount(players)` разных индексов из `0..5` в случайном порядке.
- `shared/scoring.ts`:
  - `groupPicks(picks: ReadonlyMap<string, number>): Map<number, string[]>`;
  - `scoreRound(rule, picks, mult = 1): Record<string, number>` — SPEC §5 (только игроки с очками > 0);
  - `roundStats(picks): { lone: string[]; matches: Record<string, number> }` — `lone`: единственные на своём варианте; `matches`: число других на том же варианте (только > 0).
- `shared/state.ts` `CrowState` (поля SPEC §4: `packs`, `rounds = DEFAULT_ROUNDS`, `rules`, `questionId`, `options` (`['number']`), `picked`, `peekers`, `picks`/`lone`/`matches` (`{ map: 'number' }`)); `shared/types.ts` `CrowPublicState extends ICoreState` с теми же полями (массивы → `string[]`/`number[]`, map → `Map<string, number>`).
- `shared/messages.ts`: `MSG_SETTINGS`, `MSG_HELLO`, `MSG_PICK`, `MSG_PEEK`, `MSG_YOU` (`'white-crow:…'`), `GameClientMessages` (payload-типы SPEC §4), `YouMessage = { round: number; option: number; peek: number[] }`. `shared/index.ts` реэкспортирует config, packs, catalog, logic, scoring, messages, types (не state).
- `server/CrowRoom.ts` (+ `server/index.ts` → `export { CrowRoom as Room }`), SPEC §3–4:
  - `onCreate`: `packs = DEFAULT_PACKS`; сообщения через `onGameMessage`: settings (`['lobby']`), hello (`['round','roundEnd']`), pick (`['round']`), peek (`['round']`).
  - settings — только хост, валидация SPEC §4, некорректный payload игнорируется целиком.
  - `onGameStart`: `totalRounds = rounds`, `rules = buildRules`, колода `buildDeck(packs, rounds, usedInRoom)` (id добавлять в `usedInRoom`), очистить `peekers`, `lone`, `matches`, раунд.
  - `onRoundStart(round)`: очистить `picked`, `picks`, приватные выборы и снимки; `questionId = deck[round-1]`; `options = pickShown(connectedCount())`.
  - pick: `Number.isInteger(option) && options.includes(option)`; запомнить приватно, добавить в `picked`; все подключённые выбрали → `endRound()` (то же в `onPlayerLeave` в фазе round).
  - peek: уже в `peekers` → `sendToPlayer(id, 'core:toast', { key: 'crow.toast.peekUsed' })`; иначе добавить в `peekers`, снимок `options.map(o => число выборов o)`, сохранить на раунд, отправить `you`, остальным `this.toast('crow.toast.peek', { name: nick }, clientOf(id))`.
  - hello → `you` `{ round, option: свой выбор ?? -1, peek: снимок ?? [] }`.
  - `onRoundEnd(round)`: правило `rules[round-1]`, множитель `FINAL_MULTIPLIER` в последнем раунде; опубликовать `picks`; обновить `lone`/`matches` по `roundStats`; вернуть `scoreRound`.
- Тесты logic: `buildRules` (длина, поровну при кратности 3, без повторов подряд, на 6/9/12 и 7), `buildDeck` (уникальность, приоритет неиспользованных, добор, только выбранные паки), `shownCount`/`pickShown`, `scoreRound` для всех правил по примеру SPEC §5 + множитель + пустые выборы, `roundStats`.
- Тесты room (быстрые тайминги подклассом, как `games/who-of-us/tests/room.test.ts`; если файл > 300 строк — вынести harness в `tests/harness.ts`): цикл 3 игроков × 6 раундов до results; `picks` пусты в round и заполнены в roundEnd; досрочный конец, когда все выбрали; выбор вне `options` игнорируется; повторный выбор перезаписывает; peek: снимок верный, второй раз — toast `crow.toast.peekUsed`, другим — toast `crow.toast.peek`; `hello` возвращает свой выбор; settings только хоста + валидация rounds/packs; `totalRounds` = выбранному числу; очки финала ×2; 8 входят, 9-й — `full`.
- Готово: build/test/lint `@game/white-crow` зелёные.

### C1–C4. Контент паков — @game-coder (4 агента параллельно)
- C1 `everyday` — быт и привычки: утро, выходные, дом, школа/работа без конкретики, гаджеты, праздники, погода, хобби, спорт для себя.
- C2 `fantasy` — суперсилы, «если бы ты был…», сказочные существа, магические предметы, космос и будущее, машина времени, необитаемый остров.
- C3 `food` — блюда, сладости, напитки (без алкоголя), фрукты, перекусы, кухни мира, «что взять в поход».
- C4 `world` — путешествия, страны и города (без политики), природа, животные, транспорт, времена года, чудеса света.
Файл: `games/white-crow/content/questions/<packId>.json` — **массив из 40 записей**, формат строго (SPEC §6):
```json
[
  { "e": ["🥞", "🍳", "🥣", "🥐", "🥪", "🍕"],
    "ru": { "q": "Идеальный завтрак?", "o": ["Блины", "Яичница", "Каша", "Круассан", "Бутерброд", "Вчерашняя пицца"] },
    "kk": { "q": "Тамаша таңғы ас?", "o": ["Құймақ", "Қуырылған жұмыртқа", "Ботқа", "Круассан", "Бутерброд", "Кешегі пицца"] },
    "en": { "q": "The perfect breakfast?", "o": ["Pancakes", "Fried eggs", "Porridge", "Croissant", "Sandwich", "Yesterday's pizza"] } }
]
```
- Вопрос — о вкусах и предпочтениях, без правильного ответа, чтобы хотелось угадывать выбор друзей; ≤ 70 символов, заканчивается «?». Разнообразные формулировки, без повторов внутри пака.
- Ровно 6 вариантов на каждом языке, все разные, 1–22 символа; варианты примерно равной привлекательности (нет очевидного фаворита), 1–2 забавных, но не абсурдных. `e` — 6 разных эмодзи (по одному на вариант, без модификаторов кожи и ZWJ-последовательностей, хорошо отображаются на Android/iOS).
- Индекс варианта общий для языков и `e`. Сначала ru, затем естественный перевод en и kk (грамотный казахский, кириллица, не транслит; общеизвестные заимствования допустимы).
- 0+: без алкоголя, курения, насилия, оружия, смерти, политики, религии, страшилок, туалетного юмора, брендов.
- Пиши частями и проверяй скриптом (node, без новых зависимостей): валидный JSON, длина 40, у каждой записи 6 `e` и по 6 `o` в ru/kk/en, длины, уникальность вариантов и эмодзи в записи, `q` оканчивается на `?`. Отчёт: числа проверки + 3 записи, в которых меньше всего уверен по казахскому (или «нет»).

### S1. Карточка Яндекс Игр — @game-coder
Файлы: `games/white-crow/store/{ru,en,kk}.md` по образцу `games/who-of-us/store/ru.md`: название «Белая ворона» / «Odd Crow» / «Ақ қарға» (≤ 50), короткое (≤ 100), полное (≤ 1000: 3–8 игроков, комната по коду, вопрос и варианты с эмодзи, три правила раунда — стая, пара, белая ворона, финал ×2, подглядывание, паки, языки ru/kk/en), 5–8 тегов, 0+, мультиплеер, список скриншотов (лобби с правилами, карточка правила на отсчёте, выбор варианта, раскрытие, итоги, альбом 1280×720).

## Группа 2 — после QA группы 1

### G2. Клиент — @game-coder
Зависит от G1 и C1–C4. Файлы: `games/white-crow/client/*`, `games/white-crow/content/{ru,kk,en}.json`, `games/white-crow/tests/content.test.ts`. Образцы: `games/who-of-us/client/*`, `games/spy/client/lobby.ts`, `games/bluffopedia/client/{you,vote}.ts`.
- `main.ts`: `startPartyApp<CrowPublicState>` c `catalog: CROW_CATALOG`, `monetization: CROW_MONETIZATION`, `mountGame`, `mountLobby`, `mountRoundEnd`; импорт `style.css`, `skins.css`. `index.html` — `<title>` «Белая ворона».
- `questions.ts`: импорт 4 JSON паков; `questionOf(id, lang = getLanguage()): { q: string; options: { emoji: string; label: string }[] } | null` (fallback en).
- `you.ts`: подписка на `white-crow:you`, хранит последний для текущего `round`; шлёт `hello` при монтировании экрана игры и если в round нет данных для `state.round` (не чаще раза в 2 с).
- `lobby.ts`: «Как играть» — 3 карточки правил (эмодзи 🐦 / 💞 / 🤍 + `crow.rule.<r>.name` + `crow.rule.<r>.desc`); `createPackPicker` (`ownedPacks`, `onBuy` → `ctx.openShop`, `onSelect` → `pack_selected`); «Раундов: 6/9/12» у хоста (как `games/spy/client/lobby.ts`), не-хост видит значение.
- `game.ts` (countdown + round): «Раунд N из M»; countdown — большая карточка правила `rules[round-1]` (эмодзи, название, описание), в последнем раунде «Финал: очки ×2», крупная цифра отсчёта (`client.serverNow()`); round — компактная плашка правила (+ ×2), вопрос, `pick.ts`.
- `pick.ts`: сетка кнопок по `state.options` (эмодзи крупно + подпись), класс скина `crow-skin--<ctx.cosmetics().skin>`; клик → `pick` (оптимистично подсветить, повторный клик по другому — сменить); после реконнекта подсветка из `you.option`; «Выбрали k/n» + аватары выбравших (`picked`), значок 🔭 у `peekers`; кнопка «🔭 Подсмотреть» только если `ctx.ads.canShowRewarded()` и я не в `peekers` (после `showRewarded(PEEK_PLACEMENT)` → `peek`); после `you.peek` на вариантах бейджи «👀 N».
- `reveal.ts` (mountRoundEnd): вопрос, плашка правила; варианты по одному (по возрастанию числа выборов, шаг ~0.6 с, CSS-анимация с `--d`): эмодзи, подпись, аватары выбравших, у выигравших по правилу «+N» (из `roundScore` игрока); строка итога: «Белые вороны: …» / «Пары: …» / «Стая: …» или «Никто не получил очков»; в последнем раунде — звания из `lone`/`matches` (SPEC §5).
- `style.css` (префикс `crow-`), `skins.css` (4 скина: перья — мягкий светлый градиент с узором, неон — тёмный фон + свечение, тетрадь — клетка/линейка, золото — золотой градиент). Портрет 360×640: 2 колонки, 6 вариантов без прокрутки страницы, кнопки ≥ 48 px; ≥ 720 px — 3 колонки; без горизонтального скролла.
- `content/{ru,kk,en}.json`: `game.title`, `crow.*` (все строки экранов, правила, `crow.toast.{peek,peekUsed}`, звания), `crow.pack.<id>`, `shop.<id>` для всех товаров каталога.
- `tests/content.test.ts`: равенство UI-ключей ru/kk/en; `shop.*` для каждого товара; `crow.rule.<r>.{name,desc}` для всех правил; 4 пака × 40 × 3 языка по правилам SPEC §6 (6 эмодзи/вариантов, длины, уникальность, `?`); `PACKS[i].size` = длине файла.
- Готово: build/test/lint игры; `pnpm build:web white-crow` проходит.

## Группа 3 — финал (архитектор + game-qa)
- `pnpm build|test|lint`, `pnpm build:web|build:yandex|build:telegram white-crow`, `pnpm zip:yandex white-crow`.
- Проверка вёрстки 360×640 и 1280×720 (Playwright, локальный `pnpm dev white-crow`).
- Коммит, ff в `master`, push, `pnpm check-online white-crow`.

## Группа 4 — боты для игры в одиночку (после релиза)

Сделано архитектором (контракты): `GameConfig.maxBots?: number`, `ClientMessages['core:addBot']`, `PartyRoomApi.isBot(playerId)`.

### E1. Движок: боты в лобби — @game-coder
Файлы: `packages/core/src/shared/{bots,index}.ts`, `packages/core/src/server/{PartyRoomCore,PartyRoom}.ts`, `packages/core/tests/bots.test.ts` (порт **2575**), `packages/ui/src/screens/lobby.ts`, `packages/ui/src/app-shell/phases.ts`, `packages/i18n/src/locales/*` (ключ `ui.lobby.addBot`), тесты ui при необходимости. Не трогать `games/*`.
- `core/shared/bots.ts`: `BOT_ID_PREFIX = 'bot:'`, `BOT_AVATAR = '🤖'`, `BOT_NICKS` (8 коротких нейтральных имён латиницей: Robo, Chip, Pixel, Byte, Nova, Echo, Bolt, Zed), `isBotId(id): boolean`.
- `PartyRoomCore`: приватный `Set` ботов; `protected addBot(): string | null` — только в lobby, `players.size < maxPlayers` и ботов < `config.maxBots ?? 0`; Player: id `bot:<n>` (n растёт, не переиспользуется), ник — первый свободный из `BOT_NICKS`, аватар `BOT_AVATAR`, `connected = true`, `ready = true`, `sessionId = ''`; toast `core.toast.player_joined`; `onPlayerJoin?.(id)`; `onRosterChanged()`. `isBot(id)`. `onJoin` отклоняет playerId с префиксом `bot:` (4001 `bad_options`). `kickByHost(bot)` — удалить из `players` и набора ботов (без бана), toast `core.toast.player_left`, `onRosterChanged()`. `pickHost` никогда не выбирает бота. `getPlayers`/`connectedCount` ботов включают (боты считаются для minPlayers и досрочных концов).
- `PartyRoom`: `core:addBot` — только хост, только lobby → `addBot()`. `checkAdBreak` не ждёт `core:adDone` от ботов. `handleRestart` ботов оставляет.
- ui `lobby.ts`: проп `maxBots?: number` и `onAddBot()`; хосту при `maxBots > 0` — кнопка «🤖 Добавить бота» (`ui.lobby.addBot`), скрыта/disabled при `players ≥ maxPlayers` или ботов (по `isBotId`) ≥ `maxBots`; кик бота — существующей кнопкой ✕. Нужен `maxPlayers` в пропсах. `phases.ts` передаёт из `gameConfig`, `onAddBot` → `client.send('core:addBot', {})`.
- i18n `ui.lobby.addBot`: ru «🤖 Добавить бота», kk «🤖 Бот қосу», en «🤖 Add a bot» (+ `keys.md`, если там перечислены ключи).
- Тесты core (`bots.test.ts`, тестовая комната с `maxBots: 2`, как `tests/helpers.ts`): addBot только хост и только в lobby; лимиты maxBots/maxPlayers; без `maxBots` — игнор; бот засчитывается в minPlayers (1 человек + 1 бот стартуют); кик бота хостом; хост уходит — новым хостом не становится бот; adBreak не ждёт ботов (заканчивается после adBreakMinMs, когда люди прислали adDone); playerId `bot:x` при входе → ошибка.
- Готово: build/test/lint `@party/core`, `@party/ui`, `@party/i18n` и всех игр зелёные (`pnpm -r build`).

### G3. Боты в «Белой вороне» — @game-coder
Зависит от E1 только сигнатурами (`isBot`, `config.maxBots`, `core:addBot`): E1 делается параллельно — если на момент тестов его ещё нет, подожди. Файлы: `games/white-crow/shared/{config,bots,index}.ts`, `games/white-crow/server/CrowRoom.ts` (+ `server/botDriver.ts`, если удобнее), `games/white-crow/tests/{bots,room}.test.ts`, `games/white-crow/client/lobby.ts`, `games/white-crow/content/{ru,kk,en}.json`.
- `config.ts`: `maxBots: 7` в `gameConfig`; `BOT_DELAY_MS = [2000, 9000] as const`.
- `shared/bots.ts` (чистая логика, `rnd` последним): `planBotPicks(rule, options: number[], botIds: string[], rnd): Map<string, number>` — общий «любимый» вариант раунда `fav` (случайный из `options`); flock: каждый бот с вероятностью 0.6 берёт `fav`, иначе случайный; pair: с вероятностью 0.35 `fav`, иначе случайный; odd: случайный. Ботам не известны выборы людей (не жульничают). `botDelay(rnd): number` в диапазоне `BOT_DELAY_MS`.
- `CrowRoom`: в `onRoundStart` — для ботов из `getPlayers()` (`isBot`) спланировать выборы и поставить `this.clock.setTimeout` на `botDelay`, по таймеру — тот же путь, что у `pick` (валидация, `picked`, досрочный конец). Таймеры очищать в `onRoundStart`, `onRoundEnd`, `onGameEnd`. Боты не подглядывают.
- `client/lobby.ts`: под «Как играть» подсказка хосту `crow.botsHint` («Играешь один? Добавь ботов кнопкой «🤖 Добавить бота» выше»), остальным не показывать.
- Тесты: `bots.test.ts` — `planBotPicks` (только из `options`, по боту на каждого, детерминизм с фиксированным `rnd`, на flock с `rnd`→0 все на `fav`), `botDelay` в диапазоне. `room.test.ts` — 1 человек + 2 бота (`core:addBot`) проходят партию из 6 раундов до results: в каждом раунде боты попадают в `picked`, раунд заканчивается досрочно, когда выбрал человек и боты; добавлять ботов может только хост.
- Готово: build/test/lint `@game/white-crow` зелёные; `pnpm build:web white-crow`.
