/** Звук на Web Audio без файлов. AudioContext создаётся лениво после первого жеста. */
const MAX_PER_FRAME = 5;

export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private frameCount = 0;
  private offGesture: (() => void) | null = null;

  constructor() {
    const arm = (): void => {
      this.ensure();
      this.offGesture?.();
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    this.offGesture = () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      const len = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  newFrame(): void {
    this.frameCount = 0;
  }

  private ready(): AudioContext | null {
    const c = this.ctx;
    if (!c || c.state !== 'running') {
      void c?.resume();
      return null;
    }
    if (this.frameCount >= MAX_PER_FRAME) return null;
    this.frameCount++;
    return c;
  }

  private tone(c: AudioContext, f0: number, f1: number, dur: number, vol: number, type: OscillatorType): void {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  /** Щелчок шар-шар. */
  click(impulse: number): void {
    const c = this.ready();
    if (!c) return;
    const v = Math.min(1, impulse / 0.8);
    if (v < 0.03) return;
    this.tone(c, 2600 + v * 1200, 1400, 0.05, 0.05 + v * 0.3, 'triangle');
    if (this.noise) {
      const s = c.createBufferSource();
      const g = c.createGain();
      s.buffer = this.noise;
      g.gain.value = 0.1 + v * 0.25;
      s.connect(g).connect(c.destination);
      s.start();
    }
  }

  /** Глухой стук борта. */
  thump(impulse: number): void {
    const c = this.ready();
    if (!c) return;
    const v = Math.min(1, impulse / 0.8);
    if (v < 0.03) return;
    this.tone(c, 170, 60, 0.11, 0.08 + v * 0.35, 'sine');
  }

  /** «Пум» лузы. */
  pot(): void {
    const c = this.ready();
    if (!c) return;
    this.tone(c, 130, 45, 0.28, 0.45, 'sine');
  }

  /** Удар кием. */
  strike(power: number): void {
    const c = this.ready();
    if (!c) return;
    this.tone(c, 900, 300, 0.06, 0.1 + power * 0.3, 'square');
  }

  destroy(): void {
    this.offGesture?.();
    void this.ctx?.close();
    this.ctx = null;
  }
}
