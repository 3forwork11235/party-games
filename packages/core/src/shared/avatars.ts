/** 24 эмодзи животных и еды. */
export const AVATARS: readonly string[] = [
  '🐶',
  '🐱',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐸',
  '🐵',
  '🐧',
  '🐰',
  '🐷',
  '🐮',
  '🦄',
  '🐙',
  '🍎',
  '🍕',
  '🍔',
  '🍩',
  '🍓',
  '🥑',
  '🌮',
  '🍉',
];
/** Платные аватары (совпадают с DEFAULT_CATALOG в @party/monetization). Владение сервер пока не проверяет. */
export const PREMIUM_AVATARS: readonly string[] = ['🤖', '🐲', '👽', '🦖'];

/** id цвета ника → css-цвет. 'default' — цвет по умолчанию. */
export const NICK_COLORS: Record<string, string> = {
  default: '#ffffff',
  red: '#ff5c5c',
  orange: '#ff9f43',
  yellow: '#ffd93d',
  green: '#4cd964',
  cyan: '#3dd6e0',
  blue: '#5c9dff',
  purple: '#b57cff',
  pink: '#ff7eb6',
  gold: 'linear-gradient(90deg,#ffd93d,#ff9f43)',
  rainbow: 'linear-gradient(90deg,#ff5c5c,#ffd93d,#4cd964,#5c9dff,#b57cff)',
};

/** id рамок аватара. 'none' — без рамки. */
export const FRAMES: string[] = ['none', 'bronze', 'silver', 'gold', 'neon', 'rainbow'];
