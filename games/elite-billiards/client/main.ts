import { startPartyApp } from '@party/ui/app-shell';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { gameConfig, SLUG } from '../shared/config.js';
import type { EliteBilliardsPublicState } from '../shared/types.js';
import { mountGame } from './game.js';
import { mountLobby } from './lobby.js';
import './style.css';
import './style-hotseat.css';

void startPartyApp<EliteBilliardsPublicState>({
  slug: SLUG,
  gameConfig,
  messages: { ru, kk, en },
  mountGame,
  mountLobby,
});
