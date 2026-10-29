export type TFunction = (key: string, params?: Record<string, string | number>) => string;

export interface Component {
  el: HTMLElement;
  destroy(): void;
}
