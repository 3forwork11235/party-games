import { startPartyApp } from '@party/ui/app-shell';
import en from '../content/en.json';
import kk from '../content/kk.json';
import ru from '../content/ru.json';
import { BLUFF_CATALOG } from '../shared/catalog.js';
import { gameConfig, SLUG } from '../shared/config.js';
import type { BluffPublicState } from '../shared/types.js';
import { mountGame } from './game.js';
import { mountLobby } from './lobby.js';
import { mountRoundEnd } from './reveal.js';
import './style.css';
import './reveal.css';
import './fonts.css';

void startPartyApp<BluffPublicState>({
  slug: SLUG,
  gameConfig,
  messages: { ru, kk, en },
  catalog: BLUFF_CATALOG,
  mountGame,
  mountLobby,
  mountRoundEnd,
});
