import type { Component } from './types.js';

export interface ScreenRouter {
  show(component: Component): void;
  readonly current: Component | null;
  destroy(): void;
}

/** Показывает один экран за раз, уничтожая предыдущий. */
export function createScreenRouter(root: HTMLElement): ScreenRouter {
  let current: Component | null = null;
  return {
    get current() {
      return current;
    },
    show(component) {
      if (current === component) return;
      const prev = current;
      current = component;
      prev?.destroy();
      root.replaceChildren(component.el);
    },
    destroy() {
      current?.destroy();
      current = null;
      root.replaceChildren();
    },
  };
}
