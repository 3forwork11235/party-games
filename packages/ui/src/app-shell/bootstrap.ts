import { adapterSink, createTracker } from '@party/analytics';
import type { PartyClient } from '@party/core/client';
import {
  createPartyClient,
  defaultServerUrl,
  PartyError,
  readRoomCodeFromUrl,
} from '@party/core/client';
import type { ICoreState } from '@party/core/shared';
import { getLanguage, initI18n, registerMessages, resolveLanguage, t } from '@party/i18n';
import {
  createAdManager,
  createShop,
  DEFAULT_CATALOG,
  DEFAULT_MONETIZATION_CONFIG,
} from '@party/monetization';
import { createPlatform } from '@party/platform';
import { createScreenRouter } from '../app.js';
import { createEntryScreen } from '../screens/entry.js';
import { createWaitingScreen } from '../screens/waiting.js';
import { showToast } from '../widgets/toast.js';
import { createChatDock } from './chatDock.js';
import { availableAvatars, buildJoinOptions, createCosmeticsStore } from './cosmetics.js';
import { createPhaseController } from './phases.js';
import { loadProfile, saveProfile, type Profile } from './session.js';
import { createShopFlow } from './shopFlow.js';
import type { StartPartyAppOptions } from './types.js';

function errorKey(e: unknown): string {
  return e instanceof PartyError && e.code !== 'kicked'
    ? `core.error.${e.code}`
    : 'core.error.unknown';
}

function resolveRoot(root?: HTMLElement): HTMLElement {
  if (root) return root;
  let el = document.getElementById('app');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app';
    document.body.append(el);
  }
  return el;
}

/** Общий bootstrap клиента игры: вход → лобби → раунды → результаты. */
export async function startPartyApp<S extends ICoreState = ICoreState>(
  opts: StartPartyAppOptions<S>,
): Promise<void> {
  const router = createScreenRouter(resolveRoot(opts.root));
  const waiting = (key: string): void => router.show(createWaitingScreen({ t, textKey: key }));
  waiting('ui.waiting.connecting');

  const platform = await createPlatform();
  initI18n(resolveLanguage(platform.getLanguage()));
  for (const lang of ['ru', 'kk', 'en'] as const) {
    const dict = opts.messages[lang];
    if (dict) registerMessages(lang, dict);
  }
  waiting('ui.waiting.connecting');

  const tracker = createTracker({ sink: adapterSink(platform) });
  tracker.startSession();
  const shop = createShop({
    adapter: platform,
    config: DEFAULT_MONETIZATION_CONFIG,
    catalog: DEFAULT_CATALOG,
    tracker,
    storage: platform,
  });
  await shop.refresh().catch(() => undefined);
  const adManager = createAdManager({
    adapter: platform,
    config: DEFAULT_MONETIZATION_CONFIG,
    tracker,
    entitlements: () => shop.entitlements(),
  });

  const cosmetics = createCosmeticsStore(platform, DEFAULT_CATALOG, () => shop.entitlements());
  await cosmetics.load();
  const profile: Profile = await loadProfile(platform);
  const client: PartyClient<S> = createPartyClient<S>({
    serverUrl: defaultServerUrl(),
    roomName: opts.slug,
    storage: {
      save: (k, v) => platform.saveData(k, v),
      load: <T>(k: string) => platform.loadData<T>(k),
    },
  });
  const chat = createChatDock(client, t);
  const shopFlow = createShopFlow({
    t,
    shop,
    adManager,
    catalog: DEFAULT_CATALOG,
    config: DEFAULT_MONETIZATION_CONFIG[platform.id],
    cosmetics,
  });
  const phases = createPhaseController<S>({
    opts,
    client,
    router,
    t,
    platform,
    tracker,
    adManager,
    me: profile.playerId,
    onExit: () => void client.leave(),
    chat,
    shop: shopFlow,
  });

  const launchCode = platform.getLaunchParams().roomCode ?? readRoomCodeFromUrl(location.search);
  const enter = async (code: string | null, nick: string, avatar: string): Promise<void> => {
    profile.nick = nick;
    profile.avatar = avatar;
    await saveProfile(platform, profile);
    const o = buildJoinOptions(profile, getLanguage(), cosmetics.get());
    try {
      if (code === null) await client.create(o);
      else await client.join(code, o);
    } catch (e) {
      console.error('[app-shell] enter failed', e);
      showToast(t(errorKey(e)), 'error');
    }
  };

  let lastState: S | null = null;
  const showEntry = (): void => {
    phases.reset();
    lastState = null;
    const entry = createEntryScreen({
      t,
      avatars: availableAvatars(shop.entitlements(), DEFAULT_CATALOG),
      nick: profile.nick,
      avatar: profile.avatar || undefined,
      initialCode: launchCode ?? undefined,
      onCreate: (nick, avatar) => void enter(null, nick, avatar),
      onJoin: (code, nick, avatar) => void enter(code, nick, avatar),
    });
    shopFlow.addButton(entry.el, () => {
      // покупки могли открыть новые аватары — пересоздаём экран, сохранив введённый ник
      const typed = entry.el.querySelector<HTMLInputElement>('input')?.value.trim();
      if (typed) profile.nick = typed;
      if (router.current === entry) showEntry();
    });
    router.show(entry);
  };

  client.onState((s) => {
    lastState = s;
    if (client.status === 'connected') phases.render(s);
  });
  client.onStatus((status) => {
    if (status === 'reconnecting') waiting('ui.waiting.reconnecting');
    else if (status === 'connecting') waiting('ui.waiting.connecting');
    else if (status === 'connected') {
      phases.reset();
      if (lastState) phases.render(lastState);
    } else showEntry(); // closed | idle
  });
  client.on('core:toast', (m) => showToast(t(m.key, m.params), 'info'));
  client.on('core:kicked', (m) => showToast(t(`core.kicked.${m.reason}`), 'error'));

  const restored = await client.rejoin().catch(() => false);
  if (!restored && client.status !== 'connected') showEntry();
  platform.gameReady();
}
