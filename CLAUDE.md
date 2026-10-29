# Party Games — монорепо

Мультиплеерные браузерные party-игры (2–8 игроков) на общем движке. pnpm workspaces · TS strict · Vite · Colyseus 0.16 · Canvas + ванильный DOM · Vitest · ESLint/Prettier.

## Структура
- `packages/core` — `shared/` (контракты, FSM, код комнаты, rate-limit), `server/` (`PartyRoom`), `client/` (`createPartyClient`)
- `packages/ui` — DOM-компоненты, `theme.css`, `app-shell` (общий bootstrap клиента игры)
- `packages/platform` — `PlatformAdapter`: web / yandex / telegram / capacitor
- `packages/monetization` — правила рекламы, магазин, каталог, лимиты в `config.ts`
- `packages/i18n` (ru, kk, en), `packages/analytics` (события в `events.ts`)
- `games/<slug>/` — `shared/` `server/` `client/` `content/` `SPEC.md` `TASKS.md`
- `templates/game` — шаблон для `pnpm new-game`; `scripts/` — сборка, zip, реестр
- `server/` — единый Colyseus-сервер, комнаты из `games.generated.ts`; `deploy/Caddyfile`, `docker-compose.yml`

## Команды
```
pnpm dev <slug>              # сервер :2567 + vite :5173 (доступно в LAN)
pnpm new-game <slug>         # новая игра из шаблона, потом pnpm install
pnpm build | test | lint     # весь репо; для пакета: pnpm --filter <pkg> <cmd>
pnpm build:web|build:yandex|build:telegram <slug|all>   # → dist/<platform>/<slug>
pnpm zip:yandex <slug>       # → dist/yandex/<slug>.zip
pnpm gen-registry            # пересобрать server/src/games.generated.ts
```
Тест с телефонов в LAN: [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md).

## Правила кода
- Контракты (`**/contracts.ts`, `platform/src/adapter.ts`, `analytics/src/events.ts`) меняет только архитектор.
- Сервер авторитетен: клиент шлёт намерения, сервер валидирует, считает очки и время.
- Игровые сообщения с префиксом `<slug>:`, регистрировать через `onGameMessage` (rate-limit + фазы).
- Время на сервере только `this.now()`/`this.clock`; на клиенте `client.serverNow()`.
- Тексты только через i18n-ключи; игровые словари в `games/<slug>/content/{ru,kk,en}.json`.
- Реклама и покупки только через `@party/monetization`, не напрямую через адаптер.
- Пакеты source-only (exports → `src/*.ts`), ESM, импорты с `.js`. Без `any`, файлы < 300 строк.
- Новые зависимости добавляет только архитектор (`pnpm add`), чтобы не было гонок lockfile.
- Тесты Vitest на логику; серверные комнаты через `@colyseus/testing`.

## Роли агентов
- Основная сессия — архитектор: спецификации, задачи, ревью. Сам пишет правки < 20 строк.
- `game-coder` (sonnet) — одна задача из TASKS.md → код + build/test/lint → краткий отчёт.
- `game-qa` (haiku) — build/test/lint пакета → только список ошибок.
- Большие файлы не читать целиком; независимые задачи запускать параллельно; после группы задач запускать game-qa.

## Новая игра
1. `pnpm new-game <slug>` → заполнить `games/<slug>/SPEC.md` по [docs/GAME_SPEC_TEMPLATE.md](docs/GAME_SPEC_TEMPLATE.md).
2. Разбить на задачи в `games/<slug>/TASKS.md` → game-coder → game-qa.
3. Перед публикацией: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
