import { gsap } from 'gsap';

interface PassSounds {
  stamp(): void;
  punch(): void;
}

const STATIC_HOLD_MS = 1600;

/**
 * The boarding pass that opens the simulation: it slides in, is stamped and
 * punched, then the stub tears off. The markup is rendered by the page; this
 * class only choreographs it.
 */
export class BoardingPass {
  private readonly pass: HTMLElement;
  private readonly main: HTMLElement;
  private readonly stub: HTMLElement;
  private readonly stamp: HTMLElement;
  private readonly punch: HTMLElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly sounds: PassSounds,
    private readonly reducedMotion: boolean,
  ) {
    const find = (name: string): HTMLElement => {
      const element = root.querySelector<HTMLElement>(`[data-pass-${name}]`);
      if (!element) throw new Error(`Boarding pass is missing its "${name}" part`);
      return element;
    };
    this.pass = find('card');
    this.main = find('main');
    this.stub = find('stub');
    this.stamp = find('stamp');
    this.punch = find('punch');
  }

  /** Resolves once the pass has left the screen. */
  play(): Promise<void> {
    this.root.hidden = false;
    return this.reducedMotion ? this.showStatic() : this.animate();
  }

  /** With reduced motion the stamped pass is simply shown for a moment. */
  private showStatic(): Promise<void> {
    return new Promise((resolve) => {
      this.sounds.stamp();
      setTimeout(() => {
        this.root.hidden = true;
        resolve();
      }, STATIC_HOLD_MS);
    });
  }

  private animate(): Promise<void> {
    return new Promise((resolve) => {
      const parts = [this.root, this.pass, this.main, this.stub, this.stamp, this.punch];
      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          this.root.hidden = true;
          // Leave no inline styles behind, so the pass can be played again.
          gsap.set(parts, { clearProps: 'all' });
          resolve();
        },
      });

      timeline
        .set([this.stamp, this.punch], { autoAlpha: 0 })
        .fromTo(this.root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 })
        .fromTo(
          this.pass,
          { y: 56, rotation: -5, scale: 0.94 },
          { y: 0, rotation: -1.5, scale: 1, duration: 0.65 },
          '<',
        )
        // The stamp accelerates into the paper, so it eases in rather than out.
        .fromTo(
          this.stamp,
          { scale: 2.6, rotation: -26, autoAlpha: 0 },
          { scale: 1, rotation: -12, autoAlpha: 0.88, duration: 0.17, ease: 'power4.in' },
          '+=0.4',
        )
        .call(() => this.sounds.stamp())
        .to(this.pass, { scale: 0.982, duration: 0.05, ease: 'power1.out' })
        .to(this.pass, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.45)' })
        .fromTo(
          this.punch,
          { scale: 0.3, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.1, ease: 'power2.out' },
          '+=0.3',
        )
        .call(() => this.sounds.punch())
        .to(
          this.stub,
          { x: 30, y: 12, rotation: 8, autoAlpha: 0, duration: 0.45, ease: 'power2.in' },
          '+=0.6',
        )
        .to(this.main, { y: -28, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, '<0.08')
        .to(this.root, { autoAlpha: 0, duration: 0.25 }, '-=0.12');
    });
  }
}
