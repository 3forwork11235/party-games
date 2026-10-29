// Использование: tsx scripts/zip-yandex.ts <slug> → dist/yandex/<slug>.zip
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';
import { REPO_ROOT, fail } from './lib.js';

const MAX_BYTES = 100 * 1024 * 1024;
const slug = process.argv[2];
if (!slug) fail('Использование: zip-yandex.ts <slug>');

const srcDir = path.join(REPO_ROOT, 'dist', 'yandex', slug);
if (!fs.existsSync(path.join(srcDir, 'index.html'))) {
  fail(`Нет dist/yandex/${slug}/index.html — сначала выполните pnpm build:yandex ${slug}`);
}

const files: Record<string, Uint8Array> = {};
function walk(dir: string, prefix: string): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel);
    else files[rel] = new Uint8Array(fs.readFileSync(path.join(dir, e.name)));
  }
}
walk(srcDir, '');

const zip = zipSync(files, { level: 9 });
if (zip.byteLength >= MAX_BYTES) fail(`Архив ${zip.byteLength} байт ≥ 100 МБ`);
const out = path.join(REPO_ROOT, 'dist', 'yandex', `${slug}.zip`);
fs.writeFileSync(out, zip);
console.log(
  `${out}: ${Object.keys(files).length} файлов, ${(zip.byteLength / 1024).toFixed(1)} КБ`,
);
