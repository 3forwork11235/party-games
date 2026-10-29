// Использование: tsx scripts/build-site.ts
// Собирает web-клиенты всех игр и генерирует dist/web/index.html + .nojekyll (для GitHub Pages).
import fs from 'node:fs';
import path from 'node:path';
import { GAMES_DIR, REPO_ROOT, fail, listGames, run } from './lib.js';

/** Первый строковый ключ с путём, оканчивающимся на `title`, во вложенном JSON. */
function findTitle(node: unknown, prefix = ''): string | undefined {
  if (typeof node !== 'object' || node === null) return undefined;
  for (const [key, value] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' && (p === 'title' || p.endsWith('.title'))) return value;
    const nested = findTitle(value, p);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function gameTitle(slug: string): string {
  try {
    const file = path.join(GAMES_DIR, slug, 'content', 'ru.json');
    return findTitle(JSON.parse(fs.readFileSync(file, 'utf8'))) ?? slug;
  } catch {
    return slug;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderIndex(games: { slug: string; title: string }[]): string {
  const items = games
    .map((g) => `      <li><a href="./${esc(g.slug)}/">${esc(g.title)}</a></li>`)
    .join('\n');
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Party Games</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #12141c; color: #eef0f6; font-family: system-ui, sans-serif; }
    main { max-width: 480px; margin: 0 auto; padding: 32px 16px; }
    h1 { font-size: 28px; margin: 0 0 24px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    a { display: block; padding: 18px 16px; border-radius: 14px; background: #1f2331; color: inherit; text-decoration: none; font-size: 18px; }
    a:active, a:hover { background: #2a3045; }
  </style>
</head>
<body>
  <main>
    <h1>Party Games</h1>
    <ul>
${items}
    </ul>
  </main>
</body>
</html>
`;
}

const slugs = listGames();
if (slugs.length === 0) fail('Нет игр для сборки');

const code = run('pnpm exec tsx scripts/build.ts web all', REPO_ROOT);
if (code !== 0) fail(`Сборка web завершилась с кодом ${code}`);

const outDir = path.join(REPO_ROOT, 'dist', 'web');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  renderIndex(slugs.map((slug) => ({ slug, title: gameTitle(slug) }))),
);
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log(`\nСайт: ${outDir} (${slugs.length} игр)`);
