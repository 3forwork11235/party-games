// Генерирует server/src/games.generated.ts по games/*/package.json (exports["./server"]).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = join(root, 'games');
const serverPkgPath = join(root, 'server', 'package.json');
const outPath = join(root, 'server', 'src', 'games.generated.ts');

interface Pkg {
  name?: string;
  exports?: Record<string, unknown> | string;
  dependencies?: Record<string, string>;
}

function readJson(path: string): Pkg {
  return JSON.parse(readFileSync(path, 'utf8')) as Pkg;
}

const slugs: string[] = [];
if (existsSync(gamesDir)) {
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(gamesDir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = readJson(pkgPath);
    if (typeof pkg.exports === 'object' && pkg.exports !== null && './server' in pkg.exports) {
      slugs.push(entry.name);
    }
  }
}
slugs.sort();

const lines = [
  '// АВТОГЕНЕРАЦИЯ: pnpm gen-registry. Не редактировать вручную.',
  "import type { GameServerModule } from '@party/core/server';",
  ...slugs.map((s, i) => `import * as g${i} from '@game/${s}/server';`),
  '',
  `export const GAMES: GameServerModule[] = [${slugs.map((_, i) => `g${i}`).join(', ')}];`,
  '',
];
writeFileSync(outPath, lines.join('\n'));
console.log(`games.generated.ts: ${slugs.length} game(s) [${slugs.join(', ')}]`);

const serverPkg = readJson(serverPkgPath);
const deps = { ...(serverPkg.dependencies ?? {}) };
let changed = false;
for (const s of slugs) {
  const name = `@game/${s}`;
  if (!(name in deps)) {
    deps[name] = 'workspace:*';
    changed = true;
  }
}
if (changed) {
  serverPkg.dependencies = Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n');
  console.log('server/package.json обновлён: выполните `pnpm install`.');
}
