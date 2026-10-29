import { Client, type Room } from 'colyseus.js';
import type { ClientMessages, ICoreState, JoinOptions } from '../shared/contracts.js';
import { normalizeRoomCode } from '../shared/roomCode.js';
import type { ConnectionStatus, PartyClient, PartyClientOptions } from './contracts.js';
import { PartyError, isFinalClose, mapError } from './PartyError.js';

interface SavedSession {
  token: string;
  code: string;
  opts: JoinOptions;
}

const RECONNECT_WINDOW_MS = 60000;
const MAX_BACKOFF_MS = 8000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function createPartyClient<S extends ICoreState = ICoreState>(
  options: PartyClientOptions,
): PartyClient<S> {
  const sdk = new Client(options.serverUrl);
  const storageKey = `party:rt:${options.roomName}`;
  const msgListeners = new Map<string, Set<(msg: never) => void>>();
  const stateListeners = new Set<(s: S) => void>();
  const statusListeners = new Set<(s: ConnectionStatus) => void>();

  let status: ConnectionStatus = 'idle';
  let room: Room<unknown> | null = null;
  let code: string | null = null;
  let playerId: string | null = null;
  let savedOpts: JoinOptions | null = null;
  let timeOffset = 0;
  let generation = 0; // инвалидирует фоновые попытки переподключения

  const setStatus = (s: ConnectionStatus): void => {
    if (status === s) return;
    status = s;
    statusListeners.forEach((cb) => cb(s));
  };

  const emitMessage = (type: string, msg: unknown): void => {
    if (type === 'core:time') {
      const t = (msg as { serverNow?: number } | null)?.serverNow;
      if (typeof t === 'number') timeOffset = t - Date.now();
    }
    msgListeners.get(type)?.forEach((cb) => (cb as (m: unknown) => void)(msg));
  };

  const forget = async (): Promise<void> => {
    try {
      await options.storage.save(storageKey, null);
    } catch {
      /* хранилище недоступно — не критично */
    }
  };

  const persist = async (r: Room<unknown>): Promise<void> => {
    if (!savedOpts || !code) return;
    const data: SavedSession = { token: r.reconnectionToken, code, opts: savedOpts };
    try {
      await options.storage.save(storageKey, data);
    } catch {
      /* ignore */
    }
  };

  const attach = (r: Room<unknown>, opts: JoinOptions): void => {
    room = r;
    savedOpts = opts;
    playerId = opts.playerId;
    code = r.roomId;
    r.onMessage('*', (type: string | number, msg: unknown) => emitMessage(String(type), msg));
    r.onStateChange((st) => stateListeners.forEach((cb) => cb(st as S)));
    r.onLeave((closeCode: number) => {
      if (room !== r) return;
      room = null;
      if (isFinalClose(closeCode)) {
        setStatus('closed');
        void forget();
      } else {
        void reconnectLoop(r.reconnectionToken);
      }
    });
    setStatus('connected');
    void persist(r);
    // До первого патча r.state — пустой экземпляр без полей; полный снимок придёт в onStateChange.
    const synced = (r.state as { players?: unknown } | undefined)?.players !== undefined;
    if (synced) stateListeners.forEach((cb) => cb(r.state as S));
  };

  async function reconnectLoop(token: string): Promise<void> {
    const gen = ++generation;
    const roomCode = code;
    const opts = savedOpts;
    setStatus('reconnecting');
    const started = Date.now();
    let delay = 1000;
    const useToken = token;
    while (gen === generation && Date.now() - started < RECONNECT_WINDOW_MS) {
      try {
        const r = await sdk.reconnect(useToken);
        if (gen !== generation) return void r.leave(true);
        attach(r, opts as JoinOptions);
        return;
      } catch {
        await sleep(delay);
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
      }
    }
    if (gen !== generation) return;
    if (roomCode && opts) {
      try {
        const r = await sdk.joinById(roomCode, opts);
        if (gen === generation) attach(r, opts);
        return;
      } catch {
        /* fallthrough */
      }
    }
    setStatus('closed');
    void forget();
  }

  const connect = async (open: () => Promise<Room<unknown>>, opts: JoinOptions): Promise<void> => {
    generation++;
    setStatus('connecting');
    try {
      attach(await open(), opts);
    } catch (e) {
      setStatus('closed');
      throw mapError(e);
    }
  };

  return {
    get status() {
      return status;
    },
    get code() {
      return code;
    },
    get playerId() {
      return playerId;
    },
    async create(opts) {
      await connect(() => sdk.create(options.roomName, opts), opts);
      return code as string;
    },
    async join(rawCode, opts) {
      const normalized = normalizeRoomCode(rawCode);
      if (!normalized) throw new PartyError('not_found');
      await connect(() => sdk.joinById(normalized, opts), opts);
    },
    async rejoin() {
      let saved: SavedSession | null;
      try {
        saved = await options.storage.load<SavedSession>(storageKey);
      } catch {
        saved = null;
      }
      if (!saved?.token || !saved.code || !saved.opts) return false;
      const s = saved;
      generation++;
      setStatus('connecting');
      let r: Room<unknown> | null;
      try {
        r = await sdk.reconnect(s.token);
      } catch {
        try {
          r = await sdk.joinById(s.code, s.opts);
        } catch {
          r = null;
        }
      }
      if (!r) {
        setStatus('idle');
        await forget();
        return false;
      }
      attach(r, s.opts);
      return true;
    },
    async leave() {
      generation++;
      const r = room;
      room = null;
      await forget();
      if (r) await r.leave(true);
      code = null;
      setStatus('closed');
    },
    send<K extends keyof ClientMessages>(type: K, payload: ClientMessages[K]): void {
      room?.send(type, payload);
    },
    sendGame(type, payload) {
      room?.send(type, payload);
    },
    on(type, cb) {
      return listen(msgListeners, type, cb);
    },
    onGame<T>(type: string, cb: (msg: T) => void) {
      return listen(msgListeners, type, cb);
    },
    onState(cb) {
      stateListeners.add(cb);
      return () => void stateListeners.delete(cb);
    },
    onStatus(cb) {
      statusListeners.add(cb);
      return () => void statusListeners.delete(cb);
    },
    serverNow: () => Date.now() + timeOffset,
  };
}

function listen<T>(
  map: Map<string, Set<(msg: never) => void>>,
  type: string,
  cb: (msg: T) => void,
): () => void {
  let set = map.get(type);
  if (!set) map.set(type, (set = new Set()));
  const fn = cb as (msg: never) => void;
  set.add(fn);
  return () => void set.delete(fn);
}
