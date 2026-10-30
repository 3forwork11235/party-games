import { getLanguage, type Lang } from '@party/i18n';
import city from '../content/locations/city.json';
import history from '../content/locations/history.json';
import leisure from '../content/locations/leisure.json';
import movies from '../content/locations/movies.json';
import space from '../content/locations/space.json';
import travel from '../content/locations/travel.json';
import { parseLocationId, type PackId } from '../shared/packs.js';

/** Файл пака: эмодзи и записи `[название, роль1..роль7]` по языкам. */
export type PackLocations = { emoji: string[] } & Record<Lang, string[][]>;

export const LOCATIONS: Record<PackId, PackLocations> = {
  city,
  travel,
  leisure,
  movies,
  space,
  history,
};

/** Строка записи локации: сначала на языке игрока, затем en. */
function cell(id: string, column: number, lang: Lang): string {
  const at = parseLocationId(id);
  if (!at) return '';
  const pack = LOCATIONS[at.pack];
  return pack[lang]?.[at.index]?.[column] || pack.en[at.index]?.[column] || '';
}

/** Название локации по id `"<pack>/<idx>"`. */
export function locationName(id: string, lang: Lang = getLanguage()): string {
  return cell(id, 0, lang);
}

export function locationEmoji(id: string): string {
  const at = parseLocationId(id);
  return at ? (LOCATIONS[at.pack].emoji[at.index] ?? '') : '';
}

/** Название роли `roleIndex` (0..6) в локации. */
export function roleName(id: string, roleIndex: number, lang: Lang = getLanguage()): string {
  if (!Number.isInteger(roleIndex) || roleIndex < 0) return '';
  return cell(id, 1 + roleIndex, lang);
}
