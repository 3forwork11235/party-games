import { startPartyApp } from '@party/ui/app-shell';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { WOU_CATALOG, WOU_MONETIZATION } from '../shared/catalog.js';
import { gameConfig, SLUG } from '../shared/config.js';
import type { WhoOfUsPublicState } from '../shared/types.js';
import { mountGame } from './game.js';
import { mountLobby } from './packs.js';
import { mountRoundEnd } from './reveal.js';
import './style.css';

void startPartyApp<WhoOfUsPublicState>({
  slug: SLUG,
  gameConfig,
  messages: { ru, kk, en },
  catalog: WOU_CATALOG,
  monetization: WOU_MONETIZATION,
  mountGame,
  mountLobby,
  mountRoundEnd,
});
