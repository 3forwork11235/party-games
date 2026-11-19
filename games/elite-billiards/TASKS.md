# TASKS — Элитный бильярд

Спецификация — SPEC.md. Контракты (не менять): `shared/physics/types.ts`, `shared/messages.ts`, `shared/state.ts`, `shared/types.ts`, `shared/config.ts`.

### G1. Стол, раскладка и физика (shared) — @game-coder

- `shared/table.ts`: константы L, W, CM, SM, лузы `POCKETS` (6 точек), `CUSHIONS` (6 отрезков {ax,ay,bx,by}), `KITCHEN_X`, `HEAD_SPOT`, `FOOT_SPOT`, `BALL_SPECS` (kind → r, value), `massOf(r)`, `isInsideTable(x,y)`.
- `shared/rack.ts`: `createRack(rng): Array<{id, kind, x, y, r, value}>` — биток id 0 в HEAD_SPOT + 10 прицельных по SPEC §4. `isValidCuePlacement(x, y, balls)` (дом, отступ r от бортов, нет перекрытий).
- `shared/physics/`: `constants.ts` (DT, коэффициенты, MAX_TIP_OFFSET, V0_MIN/MAX, MAX_STEPS), `strike.ts` (удар кием), `cloth.ts` (сукно/покой), `collide.ts` (шар-шар, борта, лузы), `simulation.ts` (`createSimulation(input: ShotInput): Simulation` и `simulateShot(input): ShotResult` — прогон до конца, `firstHit`, `potted`, `final` через `roundPos`), `predict.ts` (`predictFirstHit(balls, cue, dx, dy)` → {kind: 'ball'|'cushion'|'none', ghostX, ghostY, targetId?, targetDirX/Y?, cueDirX/Y?} — луч битка радиуса r против шаров (сумма радиусов) и бортов (смещённых на r)), `index.ts`.
- Строго формулы SPEC §5, детерминизм (только + - * / Math.sqrt, фиксированный порядок). Файлы < 300 строк.
- Тесты `tests/physics.test.ts`, `tests/rack.test.ts`: всё из SPEC §10 п.1 (детерминизм — два прогона идентичны `toEqual`; импульс; «стоп» равными шарами (b=0, малая сила, прямой центральный — биток почти останавливается, < 10% скорости прицельного); лёгкий small бьёт в стоящий giant — отскакивает назад; накат b=0.4 после столкновения катится вперёд; энергия не растёт между шагами; нет перекрытий > 0.5 мм и вылета (кроме забитых) при фаззинге 300 случайных ударов с seeded RNG; прямой удар в угловую лузу забивает; гигант забивается в среднюю; разбой power=1 < 25 с; правый винт об борт отклоняет отскок вправо от стрелка).
- Проверка: `pnpm --filter @game/elite-billiards build|test|lint`.

### G2. Правила и комната (shared/rules.ts + server) — @game-coder

- `shared/rules.ts`: `resolveShot` по SPEC §6 + `nextShooter(order, current, isConnected)`; добавить экспорт в `shared/index.ts` (+ table, rack, physics).
- `server/EliteBilliardsRoom.ts` (и при необходимости `server/turns.ts`, < 300 строк каждый): стадии aim/rolling по SPEC §3, сообщения по §7, валидация, лимит aim (скользящее окно), `onRoundTimeout` всегда true, `onPlayerLeave`, `onRoundEnd` (клампить к 0), `rackEndsAt`. RNG раскладки — защищённый метод `rng()` (переопределяем в тестах). Позиции в state — `roundPos`.
- Тесты `tests/rules.test.ts`, `tests/room.test.ts` (@colyseus/testing, как в games/bluffopedia/tests): старт → aim у первого; удар не стрелка игнорируется; удар → shotPlayed пришёл всем → после rolling stage aim, позиции изменились; таймаут aim → ход следующему и −1; забить все шары (подмена раскладки в тестовой комнате: 1 прицельный шар перед лузой) → roundEnd с очками.
- Проверка: build|test|lint пакета.

### G3. Клиент (client/*) — @game-coder

- `client/game.ts` (mountGame), `client/render/*.ts` (стол, шары с катящимся номиналом, кий, прицел), `client/input.ts` (прицел, ball-in-hand, слайдер силы, винт, доводка, «Удар»), `client/hud.ts`, `client/replay.ts` (проигрывание `MSG_SHOT_PLAYED` через `createSimulation` по реальному времени, догон при скрытой вкладке, снап к state при stage aim), `client/sound.ts`, `client/style.css`. По SPEC §8.
- Отображение: шары из state, кроме времени проигрывания удара. Поворот стола в портрете. devicePixelRatio. `pointer*` события, `touch-action:none`.
- Тексты — ключи `billiards.*` в `content/{ru,kk,en}.json` (+ `game.title`: «Элитный бильярд» / «Элиталық бильярд» / «Elite Billiards»), lobby-правила через `mountLobby`.
- Проверка: build|lint пакета, `pnpm build:web elite-billiards`.

### G4. Боты — @game-coder

Движок: `GameConfig.maxBots` (хост добавляет ботов кнопкой app-shell в лобби), `this.isBot(id)`; бот — подключённый игрок без клиента, его ходы делает игра (образец — games/white-crow/server/CrowRoom.ts scheduleBots, shared/bots.ts). `maxBots: 7` в `shared/config.ts`.

- `shared/bot.ts` (чистая логика, `rng` параметром): `planBotShot(balls, cueInHand, rng, opts)` → `ShotMessage` (с cueX/cueY при cueInHand).
  1. Кандидаты: каждый прицельный шар × каждая луза. Точка прицела лузы — центр створа, сдвинутый внутрь лузы на ~2 см. u = (луза − шар)/|…|; призрак = шар − u·(r_шара + r_битка); d = (призрак − биток)/|…|. Отсеять: cos(d,u) < 0.25 (слишком тонкий срез); путь битка до призрака перекрыт (`predictFirstHit` по d должен вернуть targetId этого шара); путь шара до лузы перекрыт другими шарами (расстояние от их центров до отрезка < r_шара + r_другого); гигант не в створ, который ему тесен (проверка не нужна — проходит везде, но учесть r в отступе от губок нет нужды).
  2. Оценка геометрией: value · cos² / (1 + dist_биток + 1.5·dist_шар). Топ-6 кандидатов × силы {подобранная по дистанции, ×1.35} проверяются настоящей физикой `simulateShot` (spin 0, при необходимости лёгкий накат spinY 0.15) и `resolveShot`: счёт = points (+0.5 если биток после удара не у самого борта — по желанию). Бюджет — не больше 12 вызовов `simulateShot` на удар.
  3. Выбрать лучший; если лучший счёт ≤ 0 — «безопасный» удар: полный в ближайший видимый прицельный шар средней силой (чтобы не было фола noHit); если вообще нет видимых — прямо в ближайший шар.
  4. Ошибка исполнения по уровню: к выбранному направлению добавить шум угла (сумма двух rng − 1) · `BOT_AIM_NOISE_DEG` (по умолчанию 0.9°) и ±8% силы. Угол поворачивать через Math.cos/sin — это не симуляция, детерминизм не нужен (сервер затем шлёт готовые dx,dy).
  5. Cue in hand: перебрать ~16 точек сетки в доме (`isValidCuePlacement`), для каждой — лучшая геометрическая оценка кандидатов, поставить в лучшую, дальше как выше.
- Комната: когда стрелок стал ботом в стадии aim (onRoundStart, advance, onPlayerLeave) — таймер `BOT_THINK_MS` [1500, 3000] (защищённое поле, в тестах короче); за ~700 мс до удара разослать `MSG_AIM_OF` с итоговым прицелом (и cueX/cueY), затем `handleShot(botId, shot)`. Таймеры чистить при смене стадии/раунда/onGameEnd; на срабатывании проверять, что фаза round, stage aim, shooterId тот же и shotNo не изменился.
- Клиент: в лобби подсказка хосту `billiards.botsHint` («Играешь один? Добавь бота кнопкой «🤖 Добавить бота» выше») — как в white-crow/client/lobby.ts; ru/kk/en.
- Тесты `tests/bot.test.ts`: шар перед лузой и биток на линии — бот (без шума: opts.noise 0) забивает в ≥ 9 из 10 rng-сидов; при cueInHand позиция валидна; без видимых кандидатов удар всё равно касается шара (firstHit ≥ 0); на стандартной раскладке время `planBotShot` < 400 мс. `tests/roomBots.test.ts`: человек + бот, бот сам бьёт в свой ход, игра доходит до roundEnd/следующего хода без участия человека (короткие тайминги).
