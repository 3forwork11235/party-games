export interface FsmOptions<P extends string> {
  initial: P;
  transitions: Record<P, P[]>;
  onEnter?: (to: P, from: P) => void;
  onExit?: (from: P, to: P) => void;
}

export interface Fsm<P extends string> {
  readonly current: P;
  can(to: P): boolean;
  go(to: P): void;
}

export function createFsm<P extends string>(opts: FsmOptions<P>): Fsm<P> {
  let current = opts.initial;
  const can = (to: P): boolean => opts.transitions[current].includes(to);
  return {
    get current() {
      return current;
    },
    can,
    go(to: P) {
      if (!can(to)) throw new Error(`Invalid transition: ${current} -> ${to}`);
      const from = current;
      opts.onExit?.(from, to);
      current = to;
      opts.onEnter?.(to, from);
    },
  };
}
