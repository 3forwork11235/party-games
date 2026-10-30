# TASKS — Блефопедия (bluffopedia)

Формат: `### ID. Название — @game-coder`. Спецификация — SPEC.md. Каждая задача — один агент.
Проверка после задачи: `pnpm --filter <пакет> build && pnpm --filter <пакет> test && pnpm --filter <пакет> lint`.
Общие правила: TS strict, без `any`, файлы < 300 строк (дели на модули), ESM-импорты с `.js`, тексты только через i18n.

Сделано архитектором (контракты):
- E3: `lie_fooled_count: { game; round; fooled; players }` в `packages/analytics/src/events.ts`.
- E4: `ProductDef.preview?: string` в `packages/monetization/src/contracts.ts`.

## Группа 1 — параллельно (файлы не пересекаются)

### P1. Движок: текст ответов, поле ввода, превью товара (E1, E2, E4) — @game-coder
Файлы: `packages/core/src/shared/{text,sanitize,index}.ts`, `packages/core/tests/text.test.ts`,
`packages/ui/src/widgets/answerInput.ts`, `packages/ui/src/index.ts`, `packages/ui/src/theme.css`,
`packages/ui/src/app-shell/shopFlow.ts`, тесты в `packages/ui/tests/`. Не трогать `games/*`.
- E1 `core/shared/text.ts` (экспорт из `shared/index.ts`):
  - `sanitizeAnswer(raw: unknown, maxGraphemes: number): string | null` — как `sanitizeChat` (управляющие/невидимые символы), пробелы схлопнуты, trim, обрезка по графемам; пусто → `null`. Вынести общие `stripControl`/`graphemes` из `sanitize.ts` (не дублировать).
  - `normalizeAnswer(s: string): string` — NFKC, lower-case, `ё→е`, удалить пунктуацию/кавычки/дефисы (`\p{P}`, `\p{S}`), пробелы схлопнуть, trim. «Не читать их!» → «не читать их».
  - `maskProfanity(s: string): string` — список корней грубой брани ru/kk/en (компактный, только явный мат и оскорбления), совпадение по слову, начинающемуся с корня, без учёта регистра и `ё/е`; слово целиком → `***`. Не ловить безобидные слова (тест: «хлебать», «скорбь», «class», «assistant», «Scunthorpe» не маскируются).
  - `sanitizeChat` дополнительно прогоняет `maskProfanity`.
- E2 `ui/widgets/answerInput.ts`:
  ```ts
  interface AnswerInputOptions { placeholder: string; submitLabel: string; maxLength: number; onSubmit(text: string): void; className?: string }
  interface AnswerInput extends Component { setValue(v: string): void; setDisabled(d: boolean): void; focus(): void }
  function createAnswerInput(o: AnswerInputOptions): AnswerInput;
  ```
  `<input>` + счётчик `n/max` + кнопка; Enter = отправить; пустое (после trim) не отправляется; `maxlength`; `font-size: 16px`; `enterkeyhint="send"`, `autocomplete="off"`. Стили `p-answer*` в `theme.css` (ширина 100%, кнопка ≥ 48px, без горизонтального скролла на 360px). Смотри существующие `Component`/`h` в `ui/src/{types,dom}.ts`.
- E4 shopFlow: `preview: it.preview ?? (it.category === 'avatar' ? it.value : …)`.
- Тесты: text (sanitize, normalize, mask + ложные срабатывания, чат маскирует), answerInput (Enter, пусто, счётчик, disabled), shopFlow preview если есть тесты shop.
- Готово: build/test/lint `@party/core`, `@party/ui`, `@party/monetization` зелёные; `@game/spy`, `@game/who-of-us` собираются.

### G1. Логика и сервер — @game-coder
Зависит от E1 только сигнатурами: если P1 ещё не готов, временно импортируй из `@party/core/shared` — функции появятся параллельно; в тестах не полагайся на мат-фильтр.
Файлы: `games/bluffopedia/shared/*`, `games/bluffopedia/server/*`, `games/bluffopedia/tests/{logic,room,harness}.test.ts|ts` (порт **2573**). Удалить шаблонный код. Образец устройства комнаты со стадиями — `games/spy/server/*`, `games/spy/tests/harness.ts`.
- `shared/config.ts`: `SLUG`, `gameConfig` (3–8, rounds 7, countdownMs 3000, roundMs 45000, roundEndMs 15000, idleKickSec 300), `VOTE_MS = 30000`, `LIE_MAX = 40`, `MIN_OPTIONS = 4`, `ROUND_OPTIONS = [5, 7, 10] as const`, `DEFAULT_ROUNDS = 7`, `LANGS = ['ru','kk','en'] as const`, `POINTS = { truth: 2, fooled: 1 }`.
- `shared/packs.ts`: `PACKS = [words, facts (free), laws, records (paid)]`, `size: 100`; `PackId`, `isPackId`, `DEFAULT_PACKS = ['words','facts']`, `questionIds(packs)`, `parseQuestionId`.
- `shared/catalog.ts`: `BLUFF_CATALOG` — 6 шрифтов (category `'skin'`, value = id, `preview`): `font_typewriter` ⌨️ 30, `font_handwritten` ✍️ 30, `font_storybook` 📖 30, `font_neon` 💡 40, `font_poster` 📢 35, `font_pixel` 👾 40; паки `pack_bluff_laws`, `pack_bluff_records` (50), `pack_bluff_all` (`packId: 'all'`, 80); `titleKey: 'shop.<id>'`. `HINT_PLACEMENT = 'bluffopedia_hint'`.
- `shared/logic.ts` + `shared/scoring.ts`, чистые, `rnd = Math.random` последним:
  - `pickQuestion(packs, used: ReadonlySet<string>, rnd): string`;
  - `type Option = { id: string; text: string; kind: 'truth' | 'lie' | 'house'; authors: string[] }`;
  - `buildOptions({ truth, alt, fakes, lies: ReadonlyMap<string, string> }, rnd): Option[]` — SPEC §3 (слияние по `normalizeAnswer`, текст — первого автора; добивка `fake` до `MIN_OPTIONS`, без совпадений с правдой/выдумками; id `o1..oN` после перемешивания);
  - `isTruth(text, truth, alt): boolean`;
  - `pickHint(options, playerId, rnd): string` — id ложного варианта, не своего; `''`, если после удаления не останется ни одного ложного не своего;
  - `scoreRound(options, votes: ReadonlyMap<string, string>, players: string[]): Record<string, number>` — SPEC §5.
- `shared/state.ts` `BluffState`, `BluffOption` (schema), `shared/types.ts` `BluffPublicState extends ICoreState` — поля SPEC §4.
- `shared/messages.ts`: `MSG_SETTINGS, MSG_HELLO, MSG_LIE, MSG_VOTE, MSG_HINT` (`'bluffopedia:…'`), `MSG_YOU` + `YouMessage = { round; lie; ownId; hintId }`, payload-типы.
- `server/bank.ts` — **единственное** место импорта `../content/questions/*.json`: `getQuestion(id, lang): { q; a; alt; fake } | null`. Клиент его не импортирует.
- `server/BluffRoom.ts` (+ `server/round.ts`, если > 300 строк) — SPEC §3–4: settings только хост; `onGameStart` → `totalRounds = rounds`, сброс использованных; `onRoundStart` → вопрос, `stage='write'`; `onRoundTimeout`: write → `buildOptions`, `stage='vote'`, `restartRound(VOTE_MS)`, `you` каждому, `true`; vote → `false`. Досрочно: все подключённые в `submitted` → vote; все подключённые в `voted` → `endRound()`; пересчёт и в `onPlayerLeave`. lie/vote/hint/hello по SPEC §4, отказы — `sendToPlayer(id, 'core:toast', { key })`. `onRoundEnd` публикует `truthId`, `lies`, `votes`, `stage=''`, возвращает `scoreRound`. `onPlayerJoin` в round/roundEnd → `you`.
- Тесты logic: все функции, пример SPEC §5, слияние, добивка fake, hint-граница. Тесты room (быстрые стадии подклассом, как spy harness): цикл 3 игроков × 2 раунда, правда/авторы скрыты до roundEnd, выдумка = правде → toast и не принята, досрочный переход write→vote и vote→roundEnd, нельзя голосовать за свой вариант, подсказка 1 раз, `hello` возвращает `you`, только хост меняет settings (валидация rounds/lang/packs), 8 входят, 9-й — `full`. Если контента ещё нет — в тестах подменяй банк (защищённый метод `question(id)` в комнате).
- Готово: `pnpm --filter @game/bluffopedia build|test|lint` зелёные (контент-тест не в этой задаче).

### C1–C4. Контент паков — @game-coder (4 агента параллельно)
- C1 `words` — редкие и непереводимые слова мира (японские, немецкие, скандинавские, казахские традиционные: «байғазы», «сүйінші», «тұсаукесер», «көрімдік»…), редкие английские и старинные русские слова. Формулировка «В <языке> слово «X» означает ___».
- C2 `facts` — странные факты о животных, природе, теле человека, космосе, еде, изобретениях.
- C3 `laws` — законы и официальные правила (только с документальным источником: Сингапур — продажа жвачки, Швейцария — морских свинок нельзя держать по одной, Дания — список разрешённых имён…) и традиции/обычаи народов мира.
- C4 `records` — рекорды природы и людей (Книга рекордов Гиннесса, только устойчивые), «первые» в истории и технике.
Файл: `games/bluffopedia/content/questions/<packId>.json`, формат строго (SPEC §6):
```json
{ "ru": [{ "q": "…___…", "a": "…", "alt": ["…"], "fake": ["…", "…"] }, …100],
  "kk": […100], "en": [{ "q": …, "a": …, "alt": […], "fake": […], "src": "Wikipedia: Tsundoku" }, …100] }
```
- Ровно 100 записей на язык, индекс i — один факт на всех языках. Сначала en (с `src`), затем ru и kk — естественный перевод, не транслит; kk — правильная казахская орфография.
- `q` содержит ровно один `___`, ≤ 160 символов; `a` — 1–4 слова, ≤ 30 символов; `alt` — 0–3 других допустимых написания ответа (синоним, без артикля); `fake` — 2 правдоподобные, но **неверные** версии той же длины и стиля, что и ответ.
- **Корректность важнее объёма**: только факты, которые ты знаешь уверенно и которые подтверждаются энциклопедией / Книгой рекордов; никаких городских легенд («закон запрещает…» без первоисточника), спорных этимологий, устаревающих чисел. Сомневаешься — не включай, бери другой.
- Ответ должен быть неочевидным, но после раскрытия — «ого, правда!». Без повторов внутри пака. 0+: без насилия, смерти, алкоголя, курения, политики, религиозных споров, страшилок, туалетного юмора.
- Пиши файл частями (например, по 25 записей) и проверяй скриптом: валидный JSON, 100/100/100, один `___`, длины, `fake` ≠ `a` (по нижнему регистру). Отчёт: числа проверки + 5 записей, в которых ты меньше всего уверен (или «нет»).

### S1. Карточка Яндекс Игр — @game-coder
Файлы: `games/bluffopedia/store/{ru,en,kk}.md` по образцу `games/who-of-us/store/ru.md`: название «Блефопедия» / «Bluffopedia» / «Блефопедия» (≤ 50), короткое (≤ 100), полное (≤ 1000: 3–8 игроков, комната по коду, пишешь правдоподобную выдумку, ищешь правду среди выдумок друзей, очки, паки, языки ru/kk/en), 5–8 тегов, 0+, мультиплеер, список скриншотов (лобби с паками, ввод выдумки, голосование, раскрытие, итоги, альбом 1280×720).

## Группа 2 — после QA группы 1

### G2. Клиент — @game-coder
Зависит от P1, G1. Файлы: `games/bluffopedia/client/*`, `games/bluffopedia/content/{ru,kk,en}.json`, `games/bluffopedia/tests/content.test.ts`.
- `main.ts`: `startPartyApp<BluffPublicState>` c `catalog: BLUFF_CATALOG`, `mountGame`, `mountLobby`, `mountRoundEnd`.
- `you.ts`: подписка на `bluffopedia:you`, последний для текущего `round`; шлёт `hello` при монтировании и если в round нет данных для `state.round` (не чаще раза в 2 с).
- `lobby.ts`: `createPackPicker` (`ownedPacks(ctx.entitlements(), SLUG, PACKS)`, `onBuy` → `ctx.openShop`, `onSelect` → `pack_selected`), выбор «Вопросов 5/7/10» и «Язык вопросов ru/kk/en» у хоста; если хост и `state.lang === ''` — сразу `settings` с `lang = getLanguage()`; не-хост видит значения.
- `game.ts` по `state.stage`: `write.ts` — номер/категория (`bluff.pack.<id>`), карточка вопроса (`___` → подсвеченный пропуск), `createAnswerInput` (max `LIE_MAX`), после отправки «Твоя выдумка: …» + «Изменить», «Готовы k/n»; `vote.ts` — варианты кнопками с классом шрифта `bluff-font--<ctx.cosmetics().skin>`, свой (`ownId`) — недоступен с подписью, убранный (`hintId`) — зачёркнут и недоступен, выбранный подсвечен, «Подсказка: убрать ложный 📺» только если `ctx.ads.canShowRewarded()` и `hintId === ''` (после `showRewarded(HINT_PLACEMENT)` → `hint`), «Проголосовали k/n».
- `reveal.ts` (mountRoundEnd): варианты по одному с задержкой ~1 с (выдумки по возрастанию голосов, правда последней): текст, аватары выбравших, штамп «ВЫДУМКА · ники авторов +N» / «ВЫДУМКА ИГРЫ» / «ПРАВДА», свои «+N» из `roundScore`. Аналитика: если у меня есть вариант в `lies` — один раз за раунд `lie_fooled_count { game, round, fooled, players }`.
- `fonts.css`: 6 классов `bluff-font--font_*` — системные стеки (monospace / cursive / serif italic / glow / uppercase heavy / monospace uppercase + letter-spacing), читаемые на кириллице и казахском.
- `content/{ru,kk,en}.json`: `game.title`, `bluff.*`, `bluff.pack.<id>`, `bluff.toast.{empty,truth,nohint}`, `shop.<id>` для всех товаров.
- `tests/content.test.ts`: равенство UI-ключей; `shop.*` для каждого товара; 4 пака × 100 × 3 языка по правилам SPEC §6 (один `___`, длины, `fake` ≠ `a`, 2 fake); ни один файл `client/*` не импортирует `content/questions`.
- Вёрстка: 360×640 без горизонтального скролла, варианты — 1 колонка с прокруткой внутри блока; 1280×720 — 2 колонки.
- Готово: build/test/lint игры; `pnpm build:web bluffopedia` проходит.

### F1. Сверка фактов — @general-purpose (sonnet), по паку на агента
Прочитать en-записи пака, для каждой — верно ли утверждение и ответ (знания + веб-поиск при сомнении). Вернуть список индексов с проблемой и причиной; game-coder заменяет их новыми проверенными записями на всех трёх языках.

## Группа 3 — финал (архитектор + game-qa)
- `pnpm build|test|lint`, `pnpm build:web|build:yandex|build:telegram bluffopedia`, `pnpm zip:yandex bluffopedia`.
- Коммит в ветку `bluffopedia`, ff в `master`, push, `pnpm check-online bluffopedia`.
