export type PackId = 'friends' | 'family' | 'work' | 'absurd' | 'party';

export interface PackInfo {
  id: PackId;
  free: boolean;
  size: 60;
}

export const PACKS: readonly PackInfo[] = [
  { id: 'friends', free: true, size: 60 },
  { id: 'family', free: true, size: 60 },
  { id: 'work', free: false, size: 60 },
  { id: 'absurd', free: false, size: 60 },
  { id: 'party', free: false, size: 60 },
];

export const DEFAULT_PACKS: readonly PackId[] = ['friends', 'family'];

export function isPackId(v: unknown): v is PackId {
  return typeof v === 'string' && PACKS.some((p) => p.id === v);
}
