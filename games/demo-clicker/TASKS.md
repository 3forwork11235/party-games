# TASKS — Кто быстрее (demo-clicker)

Формат: `### G1. Название — @game-coder`, затем список требований и проверка. Спецификация — SPEC.md.

### G1. Игровая логика (shared + server) — @game-coder ✅

- `shared/`: `config.ts` (GameConfig по SPEC, TARGET_TAPS=30, лимит 20/с), `state.ts` (`ClickerState`: target, clicks, finishOrder), `scoring.ts` (`scoreRound` 3/2/1/0, `createTapLimiter` — скользящее окно), `messages.ts` (`clicker:tap`), `types.ts`.
- `server/ClickerRoom.ts`: tap только в фазе round, лимит окна, фиксация finishOrder, досрочный `endRound()` когда все подключённые дошли до цели (в т.ч. при выходе игрока), очки из `scoreRound`.
- Тесты: `tests/logic.test.ts` (scoreRound, лимитер, конфиг), `tests/room.test.ts` (@colyseus/testing: 3 раунда с очками, досрочный конец, лимит 20/с). Порт теста 2569.

### G2. Клиент (client/game.ts) — @game-coder ✅

- `client/bars.ts`: canvas с полосками прогресса (аватар, ник, цвет ника, рамка, clicks/30, свой выделен).
- `client/game.ts`: цифры 3-2-1, круглая кнопка 180px на `pointerdown`, `navigator.vibrate?.(5)`, оптимистичный счётчик, истина из state, сообщение о месте.
- `content/{ru,kk,en}.json`: ключи `clicker.*`.

Проверка: `pnpm --filter @game/demo-clicker build|test|lint`, `pnpm build:web demo-clicker`, `pnpm build:yandex demo-clicker`, `pnpm zip:yandex demo-clicker`.

Не проверено: ручной прогон в двух вкладках браузера.
