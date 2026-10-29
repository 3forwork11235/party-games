/**
 * VITE_SERVER_URL; в dev — тот же origin + /colyseus (прокси Vite, работает в LAN и через туннель);
 * иначе `${ws|wss}://${hostname}:2567`.
 */
export function defaultServerUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const fromEnv = env?.VITE_SERVER_URL;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  if (typeof location === 'undefined') return 'ws://localhost:2567';
  const ws = location.protocol === 'https:' ? 'wss' : 'ws';
  if (env?.DEV === true) return `${ws}://${location.host}/colyseus`;
  return `${ws}://${location.hostname}:2567`;
}
