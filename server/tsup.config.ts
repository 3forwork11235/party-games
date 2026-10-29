import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  // Workspace-пакеты — source-only TS, их нужно забандлить.
  noExternal: [/^@party\//, /^@game\//],
  // Colyseus и его schema должны быть единственным экземпляром в рантайме.
  external: ['colyseus', /^@colyseus\//, 'express', 'ws'],
});
