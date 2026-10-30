// Невидимые/управляющие форматирующие символы (ZWJ U+200D оставляем ради составных эмодзи).
const INVISIBLE = new RegExp(
  '[​‌‎‏‪-‮⁠-⁤⁦-⁩﻿­]',
  'g',
);
const CONTROL = /\p{Cc}/gu;

export function stripControl(s: string): string {
  return s.replace(CONTROL, (c) => (/\s/.test(c) ? ' ' : '')).replace(INVISIBLE, '');
}

export function graphemes(s: string): string[] {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return Array.from(s);
  return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
}
