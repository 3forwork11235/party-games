# SETUP_TASKS — подготовка монорепо и движка

Контракты (не менять, только читать):
- `packages/core/src/shared/contracts.ts`, `packages/core/src/server/contracts.ts`, `packages/core/src/client/contracts.ts`
- `packages/platform/src/adapter.ts`, `packages/monetization/src/contracts.ts`, `packages/analytics/src/events.ts`

## Общие соглашения (для всех задач)
- Пакеты **source-only**: `"exports"` указывает на `./src/*.ts`, сборку делает потребитель (Vite / tsup / tsx). Скрипты в каждом пакете: `build` = `tsc -p . --noEmit`, `test` = `vitest run --passWithNoTests`, `lint` = `eslint .`.
- ESM (`"type": "module"`), импорты внутри пакета — с расширением `.js`, TS `moduleResolution: "Bundler"`.
- Colyseus 0.16.x (`colyseus`, `@colyseus/schema@^3`, `colyseus.js@^0.16`, `@colyseus/testing@^0.16`). Schema-классы — с декораторами (`experimentalDecorators: true`, `useDefineForClassFields: false` в tsconfig.base).
- Тексты для игрока — только ключи i18n. UI-компоненты получают `t(key, params?)` через параметры.
- Время на сервере — только через `this.now()` / `this.clock`.

---

## Волна 1

### T1. Скелет монорепо — @game-coder
- `git init`, `.gitignore` (node_modules, dist, .env, *.zip, coverage, server/data).
- Корень: `package.json` (private, `packageManager: pnpm@10.34.9`, `engines.node >=22`), `pnpm-workspace.yaml`: `packages/*`, `games/*`, `server`. `templates/` в workspace НЕ входит.
- В `pnpm-workspace.yaml` добавь `onlyBuiltDependencies: [esbuild]` (pnpm 10 по умолчанию блокирует postinstall).
- `tsconfig.base.json`: strict, noUncheckedIndexedAccess, target ES2022, module ESNext, moduleResolution Bundler, lib [ES2022, DOM, DOM.Iterable], experimentalDecorators, useDefineForClassFields false, skipLibCheck, isolatedModules, verbatimModuleSyntax false, types [].
- `eslint.config.js` (flat, typescript-eslint recommended + eslint-config-prettier, ignore dist/ и *.generated.ts), `.prettierrc` (singleQuote, printWidth 100, trailingComma all), `.editorconfig`, `vitest.workspace.ts` (или `test.projects` в корневом `vitest.config.ts`) по всем пакетам.
- Корневые скрипты (реализацию скриптов пишет T8; пока заглушка `echo TODO`, если файла нет): `dev`, `build` (`pnpm -r build`), `test` (`pnpm -r test`), `lint` (`pnpm -r lint`), `format`, `new-game`, `gen-registry`, `build:web`, `build:yandex`, `build:telegram`, `zip:yandex`.
- Создай `package.json` + `tsconfig.json` (extends base) + пустой `src/index.ts` (кроме уже существующих контрактов) для: `@party/core` (exports `./shared`, `./server`, `./client` → `src/<x>/index.ts`), `@party/ui`, `@party/platform`, `@party/monetization`, `@party/i18n`, `@party/analytics`, `@party/server` (папка `server/`).
- Зависимости (последние стабильные версии; Colyseus — 0.16.x):
  - core: colyseus, @colyseus/schema, colyseus.js; dev: @colyseus/testing
  - platform, i18n, analytics: без runtime-зависимостей
  - ui: workspace `@party/core`, `@party/platform`, `@party/i18n`, `@party/analytics`, `@party/monetization` (нужны app-shell из T8; компоненты T3 их не импортируют); export `./app-shell` (пустой `src/app-shell/index.ts`)  - monetization: `@party/platform`, `@party/analytics`
  - server: colyseus, @colyseus/ws-transport, express, `@party/core`; dev: tsx, tsup, @types/express
  - корень (dev): typescript, vite, vitest, eslint, typescript-eslint, @eslint/js, eslint-config-prettier, prettier, tsx, @types/node, jsdom, concurrently, fflate (для zip)
- Пакеты пользуются друг другом через `"workspace:*"`.
- Запусти `pnpm install`, затем `pnpm build`, `pnpm lint`. Существующие файлы контрактов должны проходить typecheck.

---

## Волна 2 (параллельно, зависимости НЕ добавлять)

### T2. @party/core — @game-coder
`src/shared/`:
- `roomCode.ts`: `generateRoomCode(rng?)`, `normalizeRoomCode(input)` (upper, убрать пробелы и дефисы; вернуть null, если длина ≠ 5 или есть символ вне `ROOM_CODE_ALPHABET`).
- `avatars.ts`: `AVATARS` — 24 эмодзи животных/еды, `NICK_COLORS: Record<string,string>` (id → css), `FRAMES: string[]` (id).
- `sanitize.ts`: `sanitizeNick(raw, fallbackIndex)` (trim, без control/zero-width, схлопнуть пробелы, ≤16 символов по графемам, пусто → `Player N`), `sanitizeChat(raw)` (≤200, без control, пусто → null).
- `rateLimit.ts`: `TokenBucket` (capacity, refillPerSec, `take(now): boolean`).
- `fsm.ts`: `createFsm<P extends string>({ initial, transitions: Record<P, P[]>, onEnter?, onExit? })` → `{ current, can(to), go(to) }`; недопустимый переход бросает Error.
- `index.ts` экспортирует всё + контракты.

`src/server/`:
- `schema.ts`: `Player` и `CoreState` (поля 1-в-1 с `IPlayer` / `ICoreState`, `players: MapSchema<Player>`). Игры наследуют `CoreState`.
- `PartyRoom.ts`: `abstract class PartyRoom<S extends CoreState> extends Room<S> implements PartyRoomApi` + абстрактные методы из `PartyRoomHooks`. Конструктор/`onCreate` берёт `config` из абстрактного `protected abstract readonly gameConfig: GameConfig` и абстрактного `createState(): S`.
  - Код комнаты: `this.roomId = code`; уникальность через `this.presence.sadd('party:codes', code)` (повтор при 0), удалить в `onDispose`. `state.code = code`. `maxClients = maxPlayers`.
  - `onJoin(client, opts: JoinOptions)`: валидировать/санитизировать. Если `playerId` уже есть в `players` → перепривязать (`sessionId`, `connected=true`, очки сохранены; старый клиент, если ещё подключён, отключить). Если новый игрок и `phase !== 'lobby'` → `throw new ServerError(4003, 'started')`. Полная комната → 4004 `'full'`. Первый игрок — хост.
  - `onLeave(client, consented)`: `connected=false`; если !consented → `allowReconnection(client, reconnectSec)`; по истечении/при consented — удалить игрока в lobby, в игре оставить с `connected=false` (очки сохранены, может вернуться через join с тем же playerId). Хост уходит окончательно → хостом становится следующий подключённый по порядку входа.
  - Фазы через `createFsm`: `lobby→countdown→round→roundEnd→(adBreak→countdown | results)`, `results→lobby`, любая → `results` (если подключённых < 2 в игре). `phaseEndsAt` выставляется при входе в фазу с таймером. `adBreak` завершается, когда все подключённые прислали `core:adDone` и прошло `adBreakMinMs`, или по `adBreakMaxMs`.
  - На `roundEnd`: `onRoundEnd` → добавить очки в `score`, записать `roundScore`. На `core:start`: обнулить `score/roundScore`, `round=1`, `onGameStart()`.
  - Тик 100 мс в фазе `round` → `onRoundTick`. По `roundMs` → завершение раунда.
  - Сообщения core из `ClientMessages` с проверкой прав хоста и фазы; `onGameMessage` из контракта.
  - Rate-limit: на каждого клиента общий `TokenBucket` + отдельный для чата (`DEFAULT_RATE_LIMIT`); сообщение сверх лимита отбрасывается, `violations++`; при `> maxViolations` → `core:kicked {reason:'flood'}` и `client.leave(4005)`.
  - Неактивность: `lastActivity` по playerId, проверка раз в 10 с; > `idleKickSec` в `lobby`/`round` → `core:kicked {reason:'idle'}`, выход.
  - `core:time` при входе и каждые 10 с. `now()` = `Date.now()` (переопределяемо).
- `index.ts` экспортирует `PartyRoom`, `CoreState`, `Player`, контракты.

`src/client/`:
- `PartyClient.ts`: `createPartyClient(opts: PartyClientOptions): PartyClient` на `colyseus.js`. `create` → `client.create(roomName, opts)`; `join` → `client.joinById(normalized, opts)` с маппингом ошибок в `PartyError` (`not_found`, `full`, `started`, `network`). Токен `room.reconnectionToken` сохраняй в `storage` под ключом `party:rt:<roomName>` вместе с `code` и `JoinOptions`. При неожиданном `onLeave` (код ≠ 1000 и ≠ 4000-4005) → статус `reconnecting`, `client.reconnect(token)` с backoff 1/2/4/8 с в пределах 60 с, затем fallback `joinById(code, savedOpts)`. `serverNow()` по смещению из `core:time`. `onState` отдаёт `room.state`.
- `defaultServerUrl()`: `import.meta.env.VITE_SERVER_URL` или `${ws|wss}://${location.hostname}:2567`.
- `inviteParams.ts`: `readRoomCodeFromUrl(search)` (`?room=`).

Тесты (Vitest): roomCode, sanitize, TokenBucket, fsm; интеграционные через `@colyseus/testing` с тестовой комнатой `TestRoom extends PartyRoom` (roundMs 300): создание с кодом из 5 символов, вход по коду, хост, старт при ≥2, полный цикл до `results`, очки сохраняются после переподключения с тем же playerId, передача хоста, флуд → кик, новый игрок в идущую игру → ошибка.

### T3. @party/ui — @game-coder
Ванильный TS + DOM, без зависимостей. Каждый компонент: `create*(props) → { el: HTMLElement; update?(...); destroy() }`. Все тексты через `props.t`.
- `theme.css`: CSS-переменные (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--danger`, `--ok`, радиусы, отступы), тёмная тема по умолчанию, `[data-theme="light"]` опционально. Mobile-first портрет: контейнер `max-width: 480px` по центру на десктопе, `100dvh`, safe-area insets, крупные тач-цели ≥ 48px, `user-select:none`, `touch-action:manipulation`, `overscroll-behavior:none`, отключить контекстное меню на игровом поле.
- `dom.ts`: хелпер `h(tag, attrs, children)`.
- `screens/entry.ts`: ник (maxlength 16), выбор аватара из `props.avatars`, кнопки «Создать комнату» и «Войти по коду» (5-символьное поле, автоверхний регистр); `initialCode` предзаполняет и подсвечивает вход.
- `screens/lobby.ts`: крупный код комнаты, кнопка «Пригласить» (`props.onInvite`), список игроков (аватар, ник с `nickColor`, рамка, корона хоста, статус ready/offline), кнопки «Готов», «Начать» (только хост, disabled при < minPlayers), «кик» у игроков для хоста. `update(state, myId)`.
- `screens/waiting.ts`: спиннер + текст (`'ui.waiting.reconnecting'` и др.).
- `screens/results.ts`: подиум топ-3 + остальные, кнопки «Ещё раз» (хост) и «Выйти».
- `screens/shop.ts`: сетка товаров (`{id, title, priceText, owned, preview}`), кнопка покупки, кнопка «Смотреть рекламу» для награды (если `onRewarded`).
- `widgets/scoreboard.ts` (сортировка по score, `roundScore` как +N), `widgets/timer.ts` (полоска + секунды; `update(endsAt, serverNow)` через rAF), `widgets/toast.ts` (`showToast(text, kind)`), `widgets/chat.ts` (сворачиваемый, последние 30 сообщений, `onSend`), `widgets/modal.ts`.
- `app.ts`: `createScreenRouter(root)` → `show(component)` с заменой и `destroy` предыдущего.
- Тесты в jsdom: роутер вызывает destroy; lobby показывает «Начать» только хосту; scoreboard сортирует.

### T4. @party/platform — @game-coder
Реализации `PlatformAdapter` из `src/adapter.ts`.
- `index.ts`: `createPlatform(): Promise<PlatformAdapter>` — по `import.meta.env.VITE_PLATFORM` (`web` по умолчанию) через `if`-ветки с dynamic import (dead-code elimination в Vite), затем `await adapter.init()`. Экспорт типов.
- `web/`: localStorage (`saveData/loadData` с JSON и try/catch), язык из `navigator.language`, `getLaunchParams` из `?room=`, `buildInviteUrl` = `origin + pathname + ?room=CODE`, `share` → `navigator.share` или clipboard, `showInterstitial/showRewarded` → **заглушка**: полноэкранный оверлей «Реклама (заглушка)» на 2 с, затем `'shown'` / `{rewarded:true}`. Покупки — заглушка в localStorage (`getCatalog` пустой, `purchase` → ok). `analytics` → `console.info('[analytics]', …)`.
- `yandex/`: глобальный `YaGames` из `<script src="/sdk.js">` (типизировать минимальным локальным `.d.ts`, без `any`). `init` → `YaGames.init()`; если `YaGames` нет — работать как web и `console.warn`. `gameReady` → `ysdk.features.LoadingAPI?.ready()`, `gameplayStart/Stop` → `GameplayAPI`. `getPlayer` → `ysdk.getPlayer({scopes:false})`. Язык → `ysdk.environment.i18n.lang`. Launch params → `ysdk.environment.payload`. Invite → `https://yandex.ru/games/app/${VITE_YANDEX_APP_ID}?payload=CODE`. Реклама → `adv.showFullscreenAdv` / `showRewardedVideo` с колбэками → Promise. Платежи → `ysdk.getPayments()`: `getCatalog`, `purchase({id})`, `getPurchases`. Данные → `player.setData/getData` (fallback localStorage). `analytics` → `ym(VITE_YM_ID,'reachGoal',event,params)` если есть `window.ym`, иначе console.
- `telegram/`: `window.Telegram.WebApp` (скрипт `telegram-web-app.js`), `init` → `ready()`, `expand()`, `disableVerticalSwipes?.()`. Игрок → `initDataUnsafe.user`. Язык → `user.language_code`. Launch params → `initDataUnsafe.start_param`. Invite → `https://t.me/${VITE_TG_BOT}/${VITE_TG_APP}?startapp=CODE`. Share → `openTelegramLink('https://t.me/share/url?url=…&text=…')`. Реклама → `'unavailable'`. Покупка → `POST ${VITE_API_URL}/api/tg/invoice {productId, initData}` → `{invoiceLink}` → `openInvoice(link, status)`, `'paid'` → ok. `getPurchases` → `GET /api/tg/purchases?initData=…`. Данные → `CloudStorage` (значения ≤ 4096, fallback localStorage).
- `capacitor/`: класс, наследующий web, `id='capacitor'`, TODO-комментарии под AdMob/Billing.
- Тесты: web-адаптер (save/load, invite url, launch params) в jsdom; yandex-адаптер с моком `YaGames` (реклама резолвится по onClose, fallback без SDK).

### T5. @party/i18n + @party/analytics — @game-coder
i18n:
- `src/locales/{ru,kk,en}.json` — вложенные ключи `ui.*`, `core.*` (ошибки: not_found, full, started, kicked.*; тосты: host_changed, player_joined, player_left), `shop.*`, `ad.*`. Полный набор ключей для экранов T3 (согласуй список ключей в `src/keys.md`). Казахский — нормальный перевод, не транслит.
- `src/index.ts`: `SUPPORTED = ['ru','kk','en']`, `resolveLanguage(raw)` (ru/kk/en; be/uk/ky/uz/tg → ru; иначе en), `initI18n(lang)`, `setLanguage`, `getLanguage`, `registerMessages(lang, dict)` (deep-merge, для игровых словарей из `games/<slug>/content`), `t(key, params?)`: подстановка `{name}`, плюрализация через `Intl.PluralRules` если есть `params.count` и ключи `key_one|_few|_many|_other`, фолбэк lang → en → key. `onLanguageChange(cb)`.
- Тесты: фолбэк, подстановка, плюрализация ru (1/2/5/21), resolveLanguage, одинаковый набор ключей во всех трёх JSON (тест сравнивает).

analytics:
- `src/tracker.ts`: `createTracker({ sink: AnalyticsSink })` → `{ track<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K]): void; startSession(): void }`. `startSession` отправляет `session_length` один раз на `pagehide`/`visibilitychange→hidden` (повторно после возврата — только прирост).
- `src/sinks.ts`: `consoleSink`, `adapterSink(adapter: { analytics(e,p):void })` (без импорта @party/platform — структурный тип), `multiSink(...)`.
- Тесты: типизация (ts-expect-error на неверные params), session_length с fake timers.

### T6. @party/monetization — @game-coder
- `src/config.ts`: `DEFAULT_MONETIZATION_CONFIG: MonetizationConfig`:
  - web: interstitial {enabled, minIntervalSec 30, firstAfterSec 0, everyNthBreak 1}, rewarded {enabled, maxPerSession 10}, purchasesEnabled true.
  - yandex: interstitial {enabled, minIntervalSec 60, firstAfterSec 30, everyNthBreak 1}, rewarded {enabled, 20}, purchasesEnabled true.
  - telegram: interstitial disabled, rewarded disabled, purchasesEnabled true (Stars).
  - capacitor: всё disabled.
  - Комментарии с обоснованием по требованиям площадок.
- `src/catalog.ts`: `DEFAULT_CATALOG: ProductDef[]` — 4 аватара, 3 рамки, 3 цвета ника, 2 эффекта, `no_ads`, пример `pack`. `starsPrice` у всех.
- `src/adManager.ts`: `createAdManager({ adapter, config, tracker, entitlements: () => Entitlements, now?: () => number, onPause?, onResume? })`:
  - `onRoundBreak(placement): Promise<AdStatus | 'skipped'>` — правила: enabled, !noAds, прошло `firstAfterSec` от создания, прошло `minIntervalSec` с прошлого показа, номер перерыва кратен `everyNthBreak`. Вокруг показа: `onPause` (выключить звук), `adapter.gameplayStop()`, после — `gameplayStart()`, `onResume`. `track('ad_shown', …)` при `'shown'`.
  - `showRewarded(placement): Promise<boolean>` — лимит `maxPerSession`, `track('ad_rewarded')`.
  - `canShowRewarded(): boolean`.
- `src/shop.ts`: `createShop({ adapter, config, catalog, tracker, storage })` → `{ list(): Promise<ShopItem[]> (catalog + priceText из adapter.getCatalog), buy(id): Promise<boolean>, refresh(): Promise<Entitlements>, entitlements(): Entitlements, grantReward(productId) }`. Награды за рекламу хранятся через `adapter.saveData('rewards', …)`. `track('purchase')` при успехе.
- Тесты (fake clock, mock adapter): интервал, firstAfter, everyNthBreak, noAds блокирует межстраничную, лимит наград, entitlements из покупок.

---

## Волна 3 (параллельно)

### Факты после волны 2 (учитывать в T7/T8)
- `import.meta.env` типизирован в `types/env.d.ts` (подключён через `tsconfig.base.json` `files`). Новые VITE_* добавлять туда.
- core: коды ошибок сервера — 4001 bad_options, 4003 started, 4004 full, 4005 kick (flood/idle/host, без реконнекта), 4006 kicked (бан хостом), 4010 no_code. Игра, переопределяющая `onCreate`, обязана вызвать `await super.onCreate(options)`. Тесты `@colyseus/testing` используют порт 2568 — не больше одного такого файла на пакет одновременно.
- core: `FRAMES`, `NICK_COLORS` (id → css), `AVATARS` (бесплатные), `PREMIUM_AVATARS` в `@party/core/shared`; каталог monetization использует те же id/эмодзи.
- ui: lobby/scoreboard принимают `nickColors`/`frameColors` (id → css) через props — передавай `NICK_COLORS` и карту рамок; `showToast` и modal принимают уже переведённый текст; `contextmenu` на игровом поле гасить в клиенте игры (класс `.p-no-context` уже есть).
- i18n: тосты core — `core.toast.{player_joined,player_left,host_changed}` с `{name}`; ошибки — `core.error.*`, кики — `core.kicked.*`.
- monetization: `titleKey` товаров = `shop.<productId>`; в словарях сейчас есть только `shop.product.*` для no_ads/pack. **T8 добавляет ключи `shop.<id>` для всех id из `DEFAULT_CATALOG` в ru/kk/en** (тест равенства ключей должен остаться зелёным).
- tracker из `@party/analytics` структурно совместим с tracker, который ожидает monetization.

### T7. server/ — @game-coder
- `scripts/gen-registry.ts` (в корне scripts/, зависимостей нет): сканирует `games/*/package.json`, у кого есть `exports["./server"]`, генерирует `server/src/games.generated.ts` с импортами `import * as g0 from '@game/<slug>/server'` и `export const GAMES: GameServerModule[] = [g0, …]`. Также добавляет `@game/<slug>: workspace:*` в `server/package.json` dependencies, если нет (и пишет в stdout, что нужен `pnpm install`).
- `server/src/index.ts`: Colyseus `Server` + `WebSocketTransport` на express; `gameServer.define(g.slug, g.Room)` для каждого из `GAMES`; `GET /health` → `{ok, games:[slugs]}`; порт `PORT` (2567), хост `0.0.0.0`; graceful shutdown.
- `server/src/telegram.ts`: `POST /api/tg/invoice` (проверка `initData` по HMAC с `TELEGRAM_BOT_TOKEN` по алгоритму Telegram; `createInvoiceLink` c `currency: 'XTR'`, `provider_token: ''`, цена из `starsPrice` каталога — каталог импортировать из `@party/monetization`), `POST /api/tg/webhook` (отвечает на `pre_checkout_query` ok=true, на `successful_payment` сохраняет покупку), `GET /api/tg/purchases`. Хранилище — JSON-файл `DATA_DIR/purchases.json` (простая обёртка с записью через temp-файл). Без токена → 501. CORS для `/api/*`.
- Скрипты: `dev` = `tsx watch src/index.ts`, `build` = `tsup src/index.ts --format esm --platform node --target node22` (бандл в `dist/`, workspace-пакеты бандлить, `colyseus`/`express` external), `start` = `node dist/index.js`.
- `server/Dockerfile` (multi-stage: pnpm install --frozen-lockfile → build server и `build:web` всех игр → runtime node:22-alpine с `dist/` и prod-зависимостями), `docker-compose.yml` в корне: сервисы `server` (порт 2567 внутри, volume `data`) и `caddy` (80/443, volume под сертификаты, статика web-сборок игр из `dist/web`). `deploy/Caddyfile`: `{$PLAY_DOMAIN}` → `file_server` из `/srv/web` (каждая игра в `/<slug>/`), `{$API_DOMAIN}` → `reverse_proxy server:2567` (WebSocket проходит сам). `.env.example`.
- Тесты: проверка HMAC initData (на известном векторе), `/health` через supertest не нужен — достаточно юнита функции валидации.
- Добавь зависимость в отчёт, если нужна (не устанавливай).

### T8. templates/game + scripts — @game-coder
- `templates/game/` — полноценный каркас игры с плейсхолдерами `__SLUG__`, `__TITLE__`, `__PASCAL__`:
  - `package.json` (`@game/__SLUG__`, exports `./server` → `server/index.ts`, `./shared` → `shared/index.ts`; скрипты dev/build/test/lint; deps: `@party/*` workspace, colyseus, @colyseus/schema, colyseus.js)
  - `tsconfig.json`, `vite.config.ts` (вызывает `createGameViteConfig(__dirname)` из `../../scripts/vite-game-config.ts`)
  - `shared/` (`index.ts`, `state.ts` — `__PASCAL__State extends CoreState`, `messages.ts`, `config.ts` — `GameConfig`), `server/index.ts` (`export const slug`, `export { __PASCAL__Room as Room }`), `server/__PASCAL__Room.ts` (минимальная реализация хуков), `client/index.html`, `client/main.ts` (bootstrap, см. ниже), `client/game.ts` (рисует пустой canvas), `content/{ru,kk,en}.json`, `SPEC.md` (копия `docs/GAME_SPEC_TEMPLATE.md`), `TASKS.md` (заготовка), `tests/logic.test.ts`.
  - `client/main.ts` — 5–10 строк: вызывает `startPartyApp({ slug, gameConfig, messages, mountGame })` из **`@party/ui/app-shell`** (export `./app-shell` → `src/app-shell/index.ts`). Модуль app-shell ты пишешь в `packages/ui/src/app-shell/` (workspace-зависимости ui на core/platform/i18n/analytics/monetization уже есть с T1). `mountGame(container, ctx) → { update(state), destroy() }`, где `ctx = { client, t, platform, me }`. App-shell: `createPlatform` → `resolveLanguage` → `initI18n` + `registerMessages` → загрузка/генерация `playerId` → `createPartyClient` → `rejoin()` или экран входа (с `initialCode` из `getLaunchParams`) → роутинг по `state.phase`: lobby / countdown+round → `mountGame` / roundEnd → scoreboard / adBreak → `adManager.onRoundBreak` затем `core:adDone` / results; тосты на ошибки и `core:toast`; статус `reconnecting` → waiting screen; invite → `adapter.share` + `track('invite_sent')`; `gameReady()` после первого экрана; tracker: `game_start`, `round_end`, `game_end`.
- `scripts/vite-game-config.ts`: `createGameViteConfig(gameDir)` → `root: client`, `base: './'`, `server: { host: true, port: 5173 }`, `define` для `VITE_PLATFORM` из `process.env.PLATFORM` (default web), `build.outDir = <repo>/dist/<platform>/<slug>`, плагин `transformIndexHtml`: для yandex вставляет `<script src="/sdk.js"></script>`, для telegram — `<script src="https://telegram.org/js/telegram-web-app.js"></script>` перед модулем.
- `scripts/new-game.ts <slug>`: валидация slug (`^[a-z][a-z0-9-]{2,30}$`), отказ если существует, копия templates/game → games/<slug> с заменой плейсхолдеров в содержимом и именах файлов, затем `gen-registry` и подсказка `pnpm install`.
- `scripts/build.ts <platform> <slug|all>`: `PLATFORM=<p> vite build` в папке игры. `scripts/zip-yandex.ts <slug>`: архив `dist/yandex/<slug>` → `dist/yandex/<slug>.zip` (index.html в корне, через fflate), проверка размера < 100 МБ.
- `scripts/dev.ts <slug>`: `concurrently` сервер (`pnpm --filter @party/server dev`) + `vite` игры. Корневой `pnpm dev <slug>`.
- Пропиши все корневые скрипты из T1.
- Проверка: `pnpm new-game tmp-check` создаёт игру, `pnpm install`, её `build` и `test` зелёные, затем удали `games/tmp-check` и снова `gen-registry`.

---

## Волна 4 (параллельно: T8b и T9)

### T8b. App-shell: чат, магазин, косметика, выход — @game-coder
Только `packages/ui/src/app-shell/**` и тесты ui (+ ключи i18n, если не хватает).
- Чат: виджет `createChat` из ui доступен в lobby и results (свёрнутый), сообщения из `core:chat`, отправка `core:chat`; при ошибке лимита сервер просто отбрасывает — клиент блокирует кнопку на 2 с после отправки.
- Магазин: кнопка в entry и lobby → `createShopScreen` (модально поверх) на `createShop` из monetization (`list`, `buy`, награда за rewarded через `adManager.showRewarded('shop_reward')` → `shop.grantReward(<случайный неполученный cosmetic>)`), скрывать покупки, если `purchasesEnabled=false`, кнопку rewarded — если `!canShowRewarded()`.
- Косметика: на экране входа платные аватары (`PREMIUM_AVATARS`) доступны только при наличии entitlement; выбранные рамка/цвет ника (последние купленные или выбранные в магазине; хранить через `platform.saveData('cosmetics')`) уходят в `JoinOptions.cosmetics` по id из `FRAMES`/`NICK_COLORS` (значение товара = id).
- Кнопка «Выйти» в лобби → `client.leave()` → экран входа.
- Тест: entitlement открывает платный аватар; cosmetics попадают в JoinOptions.

### T9. games/demo-clicker — @game-coder
`pnpm new-game demo-clicker`, `pnpm install`, скопировать `docs/specs/demo-clicker/SPEC.md` в `games/demo-clicker/SPEC.md` (заменив шаблонный), реализовать по нему: `shared/` (state, scoring), `server/ClickerRoom.ts`, `client/game.ts`, `content/`, тесты; заполнить `TASKS.md` фактически сделанным. Проверка: build/test/lint игры, `pnpm build:web demo-clicker`, `pnpm build:yandex demo-clicker`, `pnpm zip:yandex demo-clicker`.
