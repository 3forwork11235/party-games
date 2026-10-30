// Использование: pnpm check-online <slug> [--timeout <сек>]   (по умолчанию 900)
// Ждёт, пока игра станет доступна онлайн: сервер (Render) отдаёт slug в /health с коммитом HEAD,
// workflow pages.yml для HEAD завершился успешно (если доступен gh), а клиент открывается на Pages.
// Адреса: SITE_URL, SERVER_URL (ws/wss заменяются на http/https для /health).
import { execFile } from 'node:child_process';
import http from 'node:http';
import { promisify } from 'node:util';
import { REPO_ROOT, fail, gameDir } from './lib.js';

const execFileAsync = promisify(execFile);

// fetch сам не читает HTTPS_PROXY/NO_PROXY; без этого за прокси сервер Render недоступен (Node 22.21+/24).
http.setGlobalProxyFromEnv?.();

const INTERVAL_MS = 15_000;
const SERVER_REQUEST_TIMEOUT_MS = 90_000; // бесплатный Render просыпается ~1 мин
const SITE_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_S = 900;

interface Status {
  ready: boolean;
  text: string;
}
interface SiteStatus extends Status {
  /** Ссылка на упавший запуск workflow — дальше ждать бессмысленно. */
  failedRun?: string;
}
interface WorkflowRun {
  status: string;
  conclusion: string;
  url: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const short = (sha: string): string => sha.slice(0, 7);

function parseArgs(argv: string[]): { slug: string; timeoutS: number } {
  let slug: string | undefined;
  let timeoutS = DEFAULT_TIMEOUT_S;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--timeout') {
      timeoutS = Number(argv[++i]);
      if (!Number.isFinite(timeoutS) || timeoutS <= 0)
        fail('--timeout: нужно положительное число секунд');
    } else if (arg.startsWith('--')) {
      fail(`Неизвестный флаг: ${arg}`);
    } else if (slug === undefined) {
      slug = arg;
    } else {
      fail(`Лишний аргумент: ${arg}`);
    }
  }
  if (!slug) fail('Использование: pnpm check-online <slug> [--timeout <сек>]');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`Некорректный slug: ${slug}`);
  gameDir(slug);
  return { slug, timeoutS };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function toHttp(url: string): string {
  return trimSlash(url).replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

async function gitHead(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
    return stdout.trim();
  } catch (e) {
    return fail(`git rev-parse HEAD не удался: ${errText(e)}`);
  }
}

async function ghAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['auth', 'status'], { cwd: REPO_ROOT, timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/** Бюджет запроса: не дольше лимита и не дольше оставшегося до общего таймаута (минимум 5 с). */
function requestTimeout(limitMs: number, deadline: number): AbortSignal {
  return AbortSignal.timeout(Math.max(5_000, Math.min(limitMs, deadline - Date.now())));
}

async function checkServer(
  serverUrl: string,
  slug: string,
  head: string,
  deadline: number,
): Promise<Status> {
  let body: unknown;
  try {
    const res = await fetch(`${serverUrl}/health`, {
      signal: requestTimeout(SERVER_REQUEST_TIMEOUT_MS, deadline),
    });
    if (!res.ok) return { ready: false, text: `сервер: HTTP ${res.status}` };
    body = await res.json();
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    return { ready: false, text: `сервер: нет ответа (${timedOut ? 'таймаут' : errText(e)})` };
  }
  if (!isRecord(body) || !Array.isArray(body.games)) {
    return { ready: false, text: 'сервер: неожиданный ответ /health' };
  }
  const games = body.games.filter((g): g is string => typeof g === 'string');
  if (!games.includes(slug)) {
    return { ready: false, text: `сервер: игры нет в /health (есть: ${games.join(', ') || '-'})` };
  }
  const commit = typeof body.commit === 'string' && body.commit ? body.commit : null;
  if (commit !== null && commit !== head) {
    return { ready: false, text: `сервер: старый коммит ${short(commit)}, ждём ${short(head)}` };
  }
  return { ready: true, text: `сервер: ok (коммит ${commit ? short(commit) : 'не сообщён'})` };
}

async function latestRun(head: string): Promise<WorkflowRun | null> {
  const { stdout } = await execFileAsync(
    'gh',
    ['run', 'list', '--workflow', 'pages.yml', '--commit', head, '--json', 'status,conclusion,url'],
    { cwd: REPO_ROOT, timeout: 30_000 },
  );
  const list: unknown = JSON.parse(stdout);
  const first = Array.isArray(list) ? (list[0] as unknown) : undefined;
  if (!isRecord(first)) return null;
  return {
    status: String(first.status ?? ''),
    conclusion: String(first.conclusion ?? ''),
    url: String(first.url ?? ''),
  };
}

async function checkWorkflow(head: string): Promise<SiteStatus> {
  let run: WorkflowRun | null;
  try {
    run = await latestRun(head);
  } catch (e) {
    return { ready: false, text: `workflow: gh не отработал (${errText(e).split('\n')[0]})` };
  }
  if (!run) {
    return { ready: false, text: `workflow: запуска для ${short(head)} нет (коммит запушен?)` };
  }
  if (run.status !== 'completed')
    return { ready: false, text: `workflow: ${run.status} ${run.url}` };
  if (run.conclusion === 'success') return { ready: true, text: 'workflow: success' };
  return {
    ready: false,
    text: `workflow: ${run.conclusion} ${run.url}`,
    failedRun: run.url,
  };
}

async function checkPage(gameUrl: string, deadline: number): Promise<Status> {
  try {
    const res = await fetch(gameUrl, { signal: requestTimeout(SITE_REQUEST_TIMEOUT_MS, deadline) });
    await res.body?.cancel();
    return res.status === 200
      ? { ready: true, text: 'сайт: 200' }
      : { ready: false, text: `сайт: HTTP ${res.status}` };
  } catch (e) {
    return { ready: false, text: `сайт: нет ответа (${errText(e)})` };
  }
}

async function checkSite(
  gameUrl: string,
  head: string,
  useGh: boolean,
  deadline: number,
): Promise<SiteStatus> {
  const [workflow, page] = await Promise.all([
    useGh
      ? checkWorkflow(head)
      : Promise.resolve<SiteStatus>({ ready: true, text: 'workflow: пропущен (нет gh)' }),
    checkPage(gameUrl, deadline),
  ]);
  return {
    ready: workflow.ready && page.ready,
    text: `${workflow.text} | ${page.text}`,
    failedRun: workflow.failedRun,
  };
}

function stamp(startedAt: number): string {
  const s = Math.round((Date.now() - startedAt) / 1000);
  return `[${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}]`;
}

const { slug, timeoutS } = parseArgs(process.argv.slice(2));
const siteUrl = trimSlash(process.env.SITE_URL || 'https://3forwork11235.github.io/party-games');
const serverUrl = toHttp(process.env.SERVER_URL || 'wss://party-games-server-ug5f.onrender.com');
const gameUrl = `${siteUrl}/${slug}/`;

const head = await gitHead();
const useGh = await ghAvailable();
const startedAt = Date.now();
const deadline = startedAt + timeoutS * 1000;

console.log(
  `Проверяю ${slug} @ ${short(head)}: сервер ${serverUrl}, сайт ${gameUrl} (таймаут ${timeoutS} с)`,
);
if (!useGh) console.log('gh недоступен (gh auth status) — статус workflow Pages не проверяется');

for (;;) {
  const [server, site] = await Promise.all([
    checkServer(serverUrl, slug, head, deadline),
    checkSite(gameUrl, head, useGh, deadline),
  ]);
  console.log(`${stamp(startedAt)} ${server.text} | ${site.text}`);

  if (site.failedRun) fail(`\nWorkflow Pages упал: ${site.failedRun}`);
  if (server.ready && site.ready) break;

  const left = deadline - Date.now();
  if (left <= 0) {
    const pending = [!server.ready && server.text, !site.ready && site.text].filter(Boolean);
    fail(`\nТаймаут ${timeoutS} с, не готово:\n  ${pending.join('\n  ')}`);
  }
  await sleep(Math.min(INTERVAL_MS, left));
}

console.log(`
Готово: ${gameUrl}

Тест с одного компьютера (каждая вкладка — отдельный игрок):
  ${gameUrl}
  ${gameUrl}?profile=2
  ${gameUrl}?profile=3
Создайте комнату в первой вкладке, в остальных — «Войти по коду».`);
