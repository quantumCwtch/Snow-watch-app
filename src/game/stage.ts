// Canvas controller: runs the animation loop, shows special screens with a real
// PRESS START button, then the daily scene. Honours prefers-reduced-motion by
// drawing single static frames instead of animating.
import { renderScene, type HudInfo } from './renderer';
import { renderSpecial, type SpecialScreen, type ScreenOptions } from './screens';
import { W, H, type ScenePlan } from './scene';

interface SceneState {
  kind: 'scene';
  plan: ScenePlan;
  night: boolean;
  hud: HudInfo | null;
  preview: boolean;
}
interface SpecialState {
  kind: 'special';
  screen: SpecialScreen;
  opts: Omit<ScreenOptions, 't' | 'reducedMotion'>;
}

export class Stage {
  private ctx: CanvasRenderingContext2D;
  private state: SceneState | SpecialState | null = null;
  private start = performance.now();
  private raf = 0;
  private reduced: boolean;
  private onStart: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private startBtn: HTMLButtonElement,
    reducedMotion: boolean,
  ) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.reduced = reducedMotion;
    startBtn.hidden = true;
    startBtn.addEventListener('click', () => this.pressStart());
    canvas.addEventListener('click', () => {
      if (!startBtn.hidden) this.pressStart();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(this.raf);
      else this.loop();
    });
  }

  private pressStart() {
    const cb = this.onStart;
    this.onStart = null;
    this.startBtn.hidden = true;
    cb?.();
  }

  showSpecial(screen: SpecialScreen, opts: SpecialState['opts'], onStart: (() => void) | null, buttonLabel = 'PRESS START') {
    this.state = { kind: 'special', screen, opts };
    this.onStart = onStart;
    this.startBtn.hidden = !onStart;
    this.startBtn.textContent = buttonLabel;
    this.restart();
    if (onStart) setTimeout(() => this.startBtn.focus({ preventScroll: true }), 50);
  }

  showScene(plan: ScenePlan, night: boolean, hud: HudInfo | null, preview: boolean) {
    this.state = { kind: 'scene', plan, night, hud, preview };
    this.startBtn.hidden = true;
    this.onStart = null;
    this.restart();
  }

  private restart() {
    this.start = performance.now();
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  private loop = () => {
    this.draw((performance.now() - this.start) / 1000);
    if (!this.reduced && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  private draw(t: number) {
    const s = this.state;
    if (!s) return;
    this.ctx.save();
    if (s.kind === 'scene') {
      renderScene(this.ctx, { plan: s.plan, t, night: s.night, reducedMotion: this.reduced, hud: s.hud, preview: s.preview });
    } else {
      renderSpecial(this.ctx, s.screen, { ...s.opts, t, reducedMotion: this.reduced });
    }
    this.ctx.restore();
  }
}
