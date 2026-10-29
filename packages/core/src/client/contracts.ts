// КОНТРАКТ. Меняет только архитектор.
import type {
  ClientMessages,
  ICoreState,
  JoinOptions,
  ServerMessages,
} from '../shared/contracts.js';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

export interface PartyClientOptions {
  /** ws(s)://host:port; по умолчанию из import.meta.env.VITE_SERVER_URL или текущий host:2567 */
  serverUrl: string;
  /** Имя комнаты = slug игры. */
  roomName: string;
  /** Хранилище для reconnectionToken (обычно обёртка над PlatformAdapter.saveData/loadData). */
  storage: {
    save(key: string, value: unknown): Promise<void>;
    load<T>(key: string): Promise<T | null>;
  };
}

export interface PartyClient<S extends ICoreState = ICoreState> {
  readonly status: ConnectionStatus;
  readonly code: string | null;
  readonly playerId: string | null;
  /** Создать комнату (вызывающий становится хостом). Возвращает код. */
  create(opts: JoinOptions): Promise<string>;
  /** Войти по коду (регистр не важен). Бросает PartyError('not_found' | 'full' | 'started'). */
  join(code: string, opts: JoinOptions): Promise<void>;
  /** Восстановить сессию по сохранённому токену; false — если нечего восстанавливать. */
  rejoin(): Promise<boolean>;
  leave(): Promise<void>;
  send<K extends keyof ClientMessages>(type: K, payload: ClientMessages[K]): void;
  sendGame(type: string, payload: unknown): void;
  on<K extends keyof ServerMessages>(type: K, cb: (msg: ServerMessages[K]) => void): () => void;
  onGame<T>(type: string, cb: (msg: T) => void): () => void;
  /** Вызывается при любом изменении состояния (полный снимок, а не дельта). */
  onState(cb: (state: S) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  /** Серверное время с поправкой на смещение (по 'core:time'). */
  serverNow(): number;
}

export type PartyErrorCode = 'not_found' | 'full' | 'started' | 'network' | 'kicked';
