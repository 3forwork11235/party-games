# TASKS — Шпион (spy)

Формат: `### ID. Название — @game-coder`. Спецификация — SPEC.md. Каждая задача — один агент.
Проверка после задачи: `pnpm --filter <пакет> build && pnpm --filter <пакет> test && pnpm --filter <пакет> lint`.
Общие правила: TS strict, без `any`, файлы < 300 строк (дели на модули), ESM-импорты с `.js`, тексты только через i18n.

Сделано архитектором (контракты):
- E1 core: `PartyRoomApi.restartRound(ms?: number)`, хук `PartyRoomHooks.onRoundTimeout?(): boolean`
  (`packages/core/src/server/{contracts,PartyRoom}.ts`): при истечении таймера round core вызывает хук;
  `true` → раунд продолжается, иначе (и если фаза всё ещё round) — `finishRound()`.
- E2: `Cosmetics.skin?: string` (core/shared/contracts.ts), `CosmeticCategory` += `'skin'` (monetization/contracts.ts).
- E3: `spy_won`, `location_guessed` в `packages/analytics/src/events.ts`.

## Группа 1 — параллельно (файлы не пересекаются)

### P1. Движок: слот skin, таймер m:ss, общий выбор паков (E4–E6) — @game-coder ✅
Файлы: `packages/ui/src/app-shell/{cosmetics,shopFlow}.ts`, `packages/ui/src/widgets/{timer,packPicker}.ts`,
`packages/ui/src/index.ts`, `packages/ui/src/theme.css`, `packages/monetization/src/{packs,index}.ts`,
тесты в `packages/{ui,monetization,core}/tests/`, миграция `games/who-of-us/client/{packs,style}.css|ts`,
`games/who-of-us/shared/catalog.ts`.
- E4 cosmetics: слот `'skin'` (тип `Slot`, `SLOT_OF.skin = 'skin'`, цикл в `sanitizeCosmetics`, `isKnown` — непустая строка); `PREVIEW.skin = '🃏'` в shopFlow.
- E4 timer: при остатке ≥ 60 с текст `m:ss` (`5:00`, `0:59` не бывает — < 60 с остаются секунды `59`). Вынести `formatLeft(ms): string` и экспортировать.
- E5 `@party/monetization` `src/packs.ts`: `interface PackInfo { id: string; free: boolean }`;
  `ownedPacks(ent: Entitlements, game: string, packs: readonly PackInfo[]): Set<string>` — бесплатные + `${game}/${id}` + бандл `${game}/all` открывает все. Экспорт из index.
- E6 `@party/ui` `src/widgets/packPicker.ts` (экспорт из index):
  ```ts
  interface PackPickerOptions {
    t: TFunction; title: string;                 // заголовок уже переведён
    packs: readonly { id: string; free: boolean }[];
    name(id: string): string;
    owned(): ReadonlySet<string>;
    onChange(ids: string[]): void;               // хост изменил выбор (всегда ≥ 1)
    onBuy(rerender: () => void): void;           // открыть магазин, после закрытия — rerender
    onSelect?(id: string, paid: boolean): void;  // хост включил пак (аналитика)
  }
  interface PackPicker extends Component { update(selected: readonly string[], isHost: boolean): void }
  function createPackPicker(o: PackPickerOptions): PackPicker;
  ```
  Поведение — как сейчас в `games/who-of-us/client/packs.ts`: хост — чекбоксы, последний снять нельзя, у некупленных 🔒 + кнопка `t('ui.shop.buy')`; не-хост — только выбранные. Стили `p-packs`, `p-pack`, `p-pack--on`, `p-pack__lock`, `p-pack__buy` перенести из `wou-pack*` в `theme.css`.
- Миграция who-of-us: `client/packs.ts` использует `createPackPicker`, `shared/catalog.ts` `ownedPacks(ent)` — обёртка над E5 (сигнатура та же), стили `wou-pack*` удалить. Поведение и тесты who-of-us без изменений.
- Тесты: core — дописать `packages/core/tests/restartRound.test.ts` (порт 2571): `restartRound(ms)` ставит `phaseEndsAt = now + ms`; `onRoundTimeout` → `true` оставляет round, `false`/нет хука → roundEnd; хук, сам вызвавший `endRound()`, даёт ровно один `onRoundEnd`. ui — skin в sanitize/select, `formatLeft`, packPicker (хост/не-хост, замок, нельзя снять последний). monetization — `ownedPacks` (free, купленный, бандл).
- Готово: build/test/lint `@party/core`, `@party/ui`, `@party/monetization`, `@game/who-of-us` зелёные; `@game/demo-clicker` собирается.

### G1. Логика и сервер шпиона — @game-coder ✅
Файлы: `games/spy/shared/*`, `games/spy/server/*`, `games/spy/tests/{logic,room}.test.ts` (порт **2572**). Удалить шаблонный tap.
- `shared/config.ts`: `SLUG = 'spy'`; `gameConfig` (3–8, rounds 5, countdownMs 3000, roundMs 15000, roundEndMs 12000, idleKickSec 600);
  `ROLES_MS = 15000`, `DISCUSSION_MS = 300000`, `VOTING_MS = 45000`, `LAST_CHANCE_MS = 20000`,
  `BOARD_SIZE = 24`, `HINT_CROSS = 6`, `MAX_HINTS = 2`, `ROLES_PER_LOCATION = 7`, `ROUND_OPTIONS = [3, 5, 8] as const`, `DEFAULT_ROUNDS = 5`,
  очки `POINTS = { vote: 1, team: 1, escaped: 2, guessed: 4 }`.
- `shared/packs.ts`: `PACKS = [city, travel, leisure (free), movies, space, history (paid)]` с `size: 20`; `PackId`, `isPackId`, `DEFAULT_PACKS = ['city','travel','leisure']`; `locationIds(packs): string[]` (`"<pack>/<idx>"`), `parseLocationId(id): { pack: PackId; index: number } | null`.
- `shared/catalog.ts`: `SPY_CATALOG: ProductDef[]` — скины (category `'skin'`, value = id) `skin_dossier` 30, `skin_noir` 30, `skin_neon` 35, `skin_galaxy` 40, `skin_gold` 50, `skin_comic` 35; паки `pack_spy_movies|space|history` (`pack: { game: 'spy', packId }`, 50) и `pack_spy_all` (`packId: 'all'`, 120); `titleKey: 'shop.<id>'`. `HINT_PLACEMENT = 'spy_hint'`.
- `shared/logic.ts` (+ `shared/scoring.ts`), чистые функции, `rnd = Math.random` последним параметром:
  - `pickSpy(ids, spyCount: ReadonlyMap<string, number>, lastSpy: string, rnd): string` — среди min-счёта, не `lastSpy`, если есть другие;
  - `pickLocation(packs, used: ReadonlySet<string>, rnd): string` — неиспользованная в партии; все использованы → из всех;
  - `buildBoard(packs, locationId, size, rnd): string[]` — перемешано, содержит `locationId`, без дублей, `min(size, доступно)`;
  - `assignRoles(ids, rnd): Map<string, number>` — разные индексы 0..6;
  - `pickHint(board, locationId, crossed: readonly string[], n, rnd): string[]` — новый накопленный список, только неверные, не больше `board.length - 1`;
  - `findAccused(votes: ReadonlyMap<string, string>): string` — строгий максимум, иначе `''`;
  - `nextAsker(order: string[], current: string, connected: ReadonlySet<string>): string`;
  - `type Outcome = 'spy_guessed' | 'spy_wrong' | 'spy_caught' | 'spy_escaped'`; `scoreRound({ outcome, spyId, players, votes }): Record<string, number>` по SPEC §5.
- `shared/state.ts` `SpyState` и `shared/types.ts` `SpyPublicState extends ICoreState` — поля SPEC §4 (`stage` — `Stage = 'roles' | 'discussion' | 'voting' | 'lastChance' | ''`).
- `shared/messages.ts`: `MSG_SETTINGS, MSG_HELLO, MSG_SEEN, MSG_ASK, MSG_ANSWERED, MSG_PASS, MSG_CALL_VOTE, MSG_VOTE, MSG_GUESS, MSG_HINT` (`'spy:…'`), `GameClientMessages`; `MSG_ROLE = 'spy:role'` и `SpyRoleMessage = { round: number; spy: boolean; locationId?: string; roleIndex?: number; crossed: string[]; hintsLeft: number }`.
- `server/SpyRoom.ts` (+ `server/round.ts`/`server/turns.ts`, если > 300 строк), всё по SPEC §3–4:
  - lobby: `spy:settings` только от хоста; в `onGameStart` — `state.totalRounds = state.rounds`, сброс `spyCount`, использованных локаций, `lastSpy`.
  - `onRoundStart`: шпион из подключённых, локация, поле, роли остальным (включая отключённых в окне реконнекта), `stage='roles'`, `askerId` — случайный подключённый, `spy:role` каждому через `sendToPlayer`.
  - `onRoundTimeout`: roles → discussion (`restartRound(DISCUSSION_MS)`), discussion → voting (`VOTING_MS`), voting → разрешить (обвинён шпион и он подключён → lastChance `LAST_CHANCE_MS`, иначе исход и `false`), lastChance → `spy_caught`, `false`.
  - Досрочно: все подключённые в `seen` → discussion; `voteCalls` > ½ подключённых → voting; все подключённые проголосовали → разрешить голосование; `spy:guess` → исход + `endRound()`.
  - Очередь: валидация `spy:ask/answered/pass` по SPEC §4, `questions++` на «Ответил»; `onPlayerLeave` — ушёл asker → `nextAsker`, ушёл target → `targetId=''`; плюс пересчёт досрочных условий.
  - `spy:hint`: ≤ `MAX_HINTS`, `pickHint` → `spy:role` шпиону. `spy:hello` и `onPlayerJoin` (rejoin в round/roundEnd) → `spy:role`.
  - `onRoundEnd`: заполнить `spyId, locationId, accusedId, guessId, outcome, votes`, `stage=''`, вернуть `scoreRound`. `onRoundStart` очищает их. Досрочная догадка ⇔ `accusedId === ''`.
- Тесты logic: все функции + оба примера SPEC §5. Тесты room: полный цикл 3 игроков × 3 раунда (стадии ускорить подклассом с маленькими `*_MS` — константы читать через защищённые поля комнаты), в round state не содержит `spyId`/`locationId`, `spy:role` у каждого свой и у шпиона без локации, `hello` повторяет роль, досрочное голосование, все проголосовали → досрочно, ничья → `spy_escaped`, обвинён шпион → lastChance → угадал/не угадал, досрочная неверная догадка, лимит 2 подсказок, очередь (нельзя спросить себя / `lastAskerId`, «Ответил» только от target), только хост меняет settings, 8 входят, 9-й — `full`.
- Готово: `pnpm --filter @game/spy build|test|lint` зелёные.

### C1. Локации: city, travel — @game-coder ✅
### C2. Локации: leisure, movies — @game-coder ✅
### C3. Локации: space, history — @game-coder ✅
Файлы: `games/spy/content/locations/<packId>.json`, по одному паку на файл. Формат строго:
```json
{ "emoji": ["🏥", …20], "ru": [["Больница", "Хирург", …7 ролей], …20], "kk": […], "en": […] }
```
- Ровно 20 локаций в пакете, ровно 8 непустых строк в записи (название + 7 разных ролей), индекс i — одна и та же локация на трёх языках, порядок — как в списке ниже.
- Роли — профессии, посетители, участники, понятные ребёнку; у каждой роли есть повод быть в этой локации. 0+: без оружия, войны, тюрем, алкоголя, курения, болезней-страшилок, романтики, политики, религии, стереотипов о народах и внешности.
- kk — естественный казахский (не транслит), en — короткие названия (≤ 28 символов).
- Списки (en, порядок обязателен):
  - city: Hospital, School, Supermarket, Cinema, Library, Post office, Bank, Fire station, Police station, Pharmacy, Bakery, Hair salon, Car repair shop, Shopping mall, City park, Metro station, Pizzeria, Construction site, Veterinary clinic, Kindergarten
  - travel: Airport, Airplane, Passenger train, Railway station, Cruise ship, Hotel, Beach resort, Campsite, Ski resort, Highway gas station, Tour bus, Mountain hike, Ferry, Taxi, Seaport, Desert caravan, Hot air balloon, Old town tour, Cable car, Yacht
  - leisure: Circus, Zoo, Water park, Amusement park, Ice rink, Bowling alley, Museum, Theater, Concert hall, Football stadium, Swimming pool, Fitness club, Karaoke, Oceanarium, Planetarium, Escape room, Farm, Birthday party, Fishing lake, Chess club
  - movies: Pirate ship, Wild West town, Wizard school, Superhero headquarters, Detective agency, Dinosaur park, Film studio, Fairy-tale castle, Secret agent base, Jungle expedition, Treasure island, Inventor's laboratory, Dragon's cave, City of robots, Underwater kingdom, Toy shop at night, Martial arts dojo, Talent show, Racing pit stop, Time machine
  - space: Space station, Mars base, Moon base, Cosmodrome, Starship bridge, Mission control, Space hotel, Asteroid mine, Alien market, Observatory, Cosmonaut training center, Cargo spaceship, Orbital greenhouse, Ice planet station, Space elevator, Satellite repair, Rover expedition, Cosmonautics museum, Interstellar liner, Space cafe
  - history: Pyramid construction, Knight tournament, Medieval castle, Viking ship, Roman baths, Ancient Olympics, Silk Road caravanserai, Nomad camp in the steppe, Explorers' sailing ship, Royal ball, Stone Age cave, Samurai castle, Building the Great Wall, Medieval fair, Gold rush camp, First steam train, Renaissance workshop, Library of Alexandria, Maya city, First printing house
- Готово: файлы — валидный JSON (`node -e "JSON.parse(require('fs').readFileSync(...))"`), проверка размеров скриптом в отчёте.

### S1. Карточка Яндекс Игр — @game-coder ✅
Файлы: `games/spy/store/{ru,en}.md` по образцу `games/who-of-us/store/en.md`: название (≤ 50), короткое описание (≤ 100), полное (≤ 1000: как играть 3–8, комната по коду, вопросы по очереди, голосование, паки), 5–8 тегов, возраст 0+, «мультиплеер», список скриншотов (лобби с паками, карточка роли, обсуждение с полем, голосование, раскрытие).

## Группа 2 — после QA группы 1

### G2. Клиент шпиона — @game-coder ✅
Зависит от P1, G1, C1–C3. Файлы: `games/spy/client/*`, `games/spy/content/{ru,kk,en}.json`, `games/spy/tests/content.test.ts`.
- `client/main.ts`: `startPartyApp<SpyPublicState>` с `catalog: SPY_CATALOG`, `mountGame`, `mountLobby`, `mountRoundEnd`.
- `client/locations.ts`: статический импорт 6 json; `locationName(id)`, `locationEmoji(id)`, `roleName(id, roleIndex)` по `getLanguage()`, fallback en.
- `client/role.ts`: подписка на `spy:role` (`ctx.client`), хранит последнюю роль текущего `round`; шлёт `spy:hello` при монтировании и если в round нет роли для `state.round` (не чаще раза в 2 с).
- `client/lobby.ts` (mountLobby): `createPackPicker` (паки `PACKS`, `ownedPacks(ctx.entitlements(), SLUG, PACKS)`, `onBuy` → `ctx.openShop`, `onSelect` → `track('pack_selected', …)`) + выбор раундов 3/5/8 у хоста; оба шлют `spy:settings`; не-хост видит значения.
- `client/card.ts`: карточка роли (эмодзи, локация, роль / «🕵️ Ты шпион» + «Угадай локацию»), класс скина `spy-card--<ctx.cosmetics().skin>`; режимы «крупно» (roles) и «свёрнуто, тап — показать на 3 с» (остальные стадии). 6 скинов — CSS в `client/skins.css`.
- `client/game.ts` + `client/turn.ts` + `client/board.ts` + `client/vote.ts` — экраны SPEC §7 по `state.stage`:
  roles — карточка + «Понял» (`spy:seen`) + «Готовы k/n»; discussion — «X спрашивает Y» / «Твой ход: выбери, кого спросить» (сетка игроков, недоступны себя и `lastAskerId`) / «Ответь вслух и нажми «Ответил»», «Передать ход» (asker и хост), поле `board` (у шпиона — зачёркнутые `crossed`), шпиону «Назвать локацию» (режим выбора на поле → подтверждение → `spy:guess`) и «Подсказка» (1-я — сразу `spy:hint`; 2-я — «Подсказка 📺», только если `ctx.ads.canShowRewarded()`, после `showRewarded(HINT_PLACEMENT)` → `spy:hint`), всем — «Голосовать k/n» (`spy:callVote`); voting — сетка игроков, свой выбор подсвечен, «Проголосовали k/n»; lastChance — шпион выбирает на поле, остальные «Шпион угадывает локацию…».
- `client/reveal.ts` (mountRoundEnd): шпион крупно (аватар, ник), эмодзи и название локации, текст исхода (4 варианта), догадка шпиона, кто за кого голосовал, «+N» по `roundScore`. Аналитика с клиента шпиона (`me === spyId`), один раз за раунд: `location_guessed { game, round, locationId: guessId, correct, early: accusedId === '' }` если `guessId`; `spy_won { reason: outcome === 'spy_guessed' ? 'guessed' : 'escaped', players }` если исход — победа шпиона.
- `content/{ru,kk,en}.json`: `game.title`, ключи `spy.*`, `spy.pack.<id>`, `shop.<productId>` для 10 товаров. CSS: `client/style.css` + `client/skins.css`, классы `spy-*`.
- `tests/content.test.ts`: равенство ключей UI-словарей; 6 паков × 20 записей × 8 непустых строк на ru/kk/en, 20 эмодзи; названия локаций уникальны внутри языка; есть `shop.*` для каждого товара `SPY_CATALOG`.
- Вёрстка: 360×640 без горизонтального скролла (`min-width:0`, `overflow-wrap:anywhere`), поле — 3 колонки с прокруткой внутри блока, тач-цели ≥ 48px; десктоп 1280×720 — поле 6 колонок.
- Готово: build/test/lint игры; `pnpm build:web spy` проходит.

## Группа 3 — финал (архитектор + game-qa) ✅
- `pnpm build|test|lint`, `pnpm build:web|build:yandex|build:telegram spy`, `pnpm zip:yandex spy`.
- Ручной прогон 3 вкладок на `pnpm dev spy`.
- Итог: 214 тестов зелёные, `spy.zip` 92 КБ. Ручной прогон на 3 вкладках: роли, очередь, подсказка, досрочное
  голосование, последний шанс, досрочная неверная догадка, реконнект с восстановлением роли, аналитика, 360/1280 без скролла.
- Архитектор по итогам прогона: ru-фраза очереди без склонения ника; `round_end`/`game_end` в app-shell не шлются,
  если клиент не видел начало (после перезагрузки durationMs считался от 0).
