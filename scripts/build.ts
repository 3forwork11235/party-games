// Использование: tsx scripts/build.ts <web|yandex|telegram|capacitor> <slug|all>
import { fail, gameDir, listGames, run } from './lib.js';

const [platform, target] = process.argv.slice(2);
if (!platform || !['web', 'yandex', 'telegram', 'capacitor'].includes(platform)) {
  fail('Использование: build.ts <web|yandex|telegram|capacitor> <slug|all>');
}
if (!target) fail('Укажите slug игры или "all"');

const slugs = target === 'all' ? listGames() : [target];
if (slugs.length === 0) fail('Нет игр для сборки');

for (const slug of slugs) {
  console.log(`\n== build ${slug} [${platform}] ==`);
  const code = run('pnpm exec vite build', gameDir(slug), { PLATFORM: platform });
  if (code !== 0) fail(`Сборка ${slug} (${platform}) завершилась с кодом ${code}`);
}
