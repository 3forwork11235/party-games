/** VITE_SERVER_URL или `${ws|wss}://${hostname}:2567`. */
export function defaultServerUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_SERVER_URL;
  if (fromEnv) return fromEnv;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  const host = typeof location !== 'undefined' ? location.hostname : 'localhost';
  return `${secure ? 'wss' : 'ws'}://${host}:2567`;
}
