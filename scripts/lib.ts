import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAMES_DIR = path.join(REPO_ROOT, 'games');

export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** Запуск команды с наследованием stdio; возвращает код выхода. */
export function run(cmd: string, cwd: string, env: Record<string, string> = {}): number {
  const r = spawnSync(cmd, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  return r.status ?? 1;
}

/** Slug-и всех игр, у которых есть vite.config.ts. */
export function listGames(): string[] {
  if (!fs.existsSync(GAMES_DIR)) return [];
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(GAMES_DIR, d.name, 'vite.config.ts')))
    .map((d) => d.name);
}

export function gameDir(slug: string): string {
  const dir = path.join(GAMES_DIR, slug);
  if (!fs.existsSync(dir)) fail(`Игра не найдена: games/${slug}`);
  return dir;
}
