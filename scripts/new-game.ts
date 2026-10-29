// Использование: tsx scripts/new-game.ts <slug>
import fs from 'node:fs';
import path from 'node:path';
import { GAMES_DIR, REPO_ROOT, fail, run } from './lib.js';

const SLUG_RE = /^[a-z][a-z0-9-]{2,30}$/;
const slug = process.argv[2];
if (!slug || !SLUG_RE.test(slug)) {
  fail('Использование: pnpm new-game <slug>; slug: ^[a-z][a-z0-9-]{2,30}$');
}

const target = path.join(GAMES_DIR, slug);
if (fs.existsSync(target)) fail(`games/${slug} уже существует`);

const words = slug.split('-').filter(Boolean);
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);
const vars: Record<string, string> = {
  __SLUG__: slug,
  __TITLE__: words.map(cap).join(' '),
  __PASCAL__: words.map(cap).join(''),
};
const replaceAll = (s: string): string =>
  s.replace(/__SLUG__|__TITLE__|__PASCAL__/g, (m) => vars[m] ?? m);

function copyDir(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name);
    const to = path.join(dst, replaceAll(e.name));
    if (e.isDirectory()) copyDir(from, to);
    else fs.writeFileSync(to, replaceAll(fs.readFileSync(from, 'utf8')));
  }
}

copyDir(path.join(REPO_ROOT, 'templates', 'game'), target);
console.log(`Создано games/${slug}`);

if (fs.existsSync(path.join(REPO_ROOT, 'scripts', 'gen-registry.ts'))) {
  const code = run('pnpm gen-registry', REPO_ROOT);
  if (code !== 0) console.warn('gen-registry завершился с ошибкой — выполните его вручную');
} else {
  console.warn('scripts/gen-registry.ts не найден — шаг gen-registry пропущен');
}
console.log('\nДальше: pnpm install, затем заполните games/' + slug + '/SPEC.md');
