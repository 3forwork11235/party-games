import { startPartyApp } from '@party/ui/app-shell';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { CROW_CATALOG, CROW_MONETIZATION } from '../shared/catalog.js';
import { gameConfig, SLUG } from '../shared/config.js';
import type { CrowPublicState } from '../shared/types.js';
import { mountGame } from './game.js';
import { mountLobby } from './lobby.js';
import { mountRoundEnd } from './reveal.js';
import './style.css';
import './reveal.css';
import './skins.css';

void startPartyApp<CrowPublicState>({
  slug: SLUG,
  gameConfig,
  messages: { ru, kk, en },
  catalog: CROW_CATALOG,
  monetization: CROW_MONETIZATION,
  mountGame,
  mountLobby,
  mountRoundEnd,
});
