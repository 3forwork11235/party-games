// Использование: tsx scripts/dev.ts <slug> — сервер :2567 + vite :5173 (LAN)
import { fail, gameDir, REPO_ROOT, run } from './lib.js';

const slug = process.argv[2];
if (!slug) fail('Использование: pnpm dev <slug>');
gameDir(slug);

const cmd = [
  'pnpm exec concurrently -k -n server,client -c blue,green',
  '"pnpm --filter @party/server dev"',
  `"pnpm --dir games/${slug} exec vite"`,
].join(' ');
process.exit(run(cmd, REPO_ROOT, { PLATFORM: process.env.PLATFORM ?? 'web' }));
