import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';

export type BuildPlatform = 'web' | 'yandex' | 'telegram' | 'capacitor';

/** Вставляет в index.html SDK площадки перед модульным скриптом. */
function platformScripts(platform: string): Plugin {
  return {
    name: 'party-platform-scripts',
    transformIndexHtml() {
      if (platform === 'yandex') {
        return [{ tag: 'script', attrs: { src: '/sdk.js' }, injectTo: 'head-prepend' }];
      }
      if (platform === 'telegram') {
        return [
          {
            tag: 'script',
            attrs: { src: 'https://telegram.org/js/telegram-web-app.js' },
            injectTo: 'head-prepend',
          },
        ];
      }
      return [];
    },
  };
}

/** Общий конфиг Vite для клиента игры. gameDir — папка games/<slug>. */
export function createGameViteConfig(gameDir: string): UserConfig {
  const slug = path.basename(gameDir);
  const repoRoot = path.resolve(gameDir, '..', '..');
  const platform = process.env.PLATFORM || 'web';
  return defineConfig({
    root: path.join(gameDir, 'client'),
    base: './',
    envDir: repoRoot,
    plugins: [platformScripts(platform)],
    server: {
      host: true,
      port: 5173,
      fs: { allow: [repoRoot] },
      // Туннели (tuna, cloudflared) приходят с чужим Host.
      allowedHosts: true,
      // Один порт наружу: сервер Colyseus доступен через /colyseus (HTTP + WebSocket).
      proxy: {
        '/colyseus': {
          target: 'http://localhost:2567',
          ws: true,
          rewrite: (p: string) => p.replace(/^\/colyseus/, ''),
        },
      },
    },
    define: {
      'import.meta.env.VITE_PLATFORM': JSON.stringify(platform),
    },
    test: { root: gameDir, include: ['tests/**/*.test.ts'] },
    build: {
      outDir: path.join(repoRoot, 'dist', platform, slug),
      emptyOutDir: true,
      target: 'es2022',
    },
  });
}
