import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameViteConfig } from '../../scripts/vite-game-config.js';

export default createGameViteConfig(path.dirname(fileURLToPath(import.meta.url)));
