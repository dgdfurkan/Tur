import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { yieldToMain } from '@/shared/scheduling';
import type { FilmCopy } from './FilmCopy';
import { FilmDirector } from './FilmDirector';
import { layoutFor } from './FilmLayout';
import { soundCues } from './FilmOverlay';
import { FilmPainter } from './FilmPainter';
import type { FilmRecorderFactory } from './FilmRecorder';
import type { FilmStage } from './FilmStage';
import { bitrate, pixelSize, type FilmFormat, type FilmQuality, type FrameRate } from './formats';
import type { Logo } from './paint/Logo';
import { SceneImages } from './SceneImages';
import { renderSoundtrack } from './Soundtrack';
import { Storyboard, type FilmTemplate } from './Storyboard';

/** Everything that decides what a film shows. */
export interface FilmJob {
  readonly plan: RoutePlan;
  readonly template: FilmTemplate;
  readonly copy: FilmCopy;
  readonly format: FilmFormat;
  readonly logo: Logo;
}

/** Everything that decides how a film is written to a file. */
export interface ExportSettings {
  readonly quality: FilmQuality;
  readonly frameRate: FrameRate;
  readonly sound: boolean;
}

export interface ExportResult {
  readonly file: Blob;
  /** False when a soundtrack was wanted but this browser could not encode one. */
  readonly hasSound: boolean;
}

/** Thrown when this browser cannot encode video at the size asked for. */
export class UnsupportedFilmError extends Error {}

interface LoadedFilm {
  readonly job: FilmJob;
  readonly storyboard: Storyboard;
  readonly director: FilmDirector;
  readonly painter: FilmPainter;
}

/** Sharp enough for the preview on a screen, cheap enough to play in real time. */
const PREVIEW_PIXEL_RATIO = 2;
/** The longest the export goes without letting the page update its progress. */
const BREATHE_EVERY_MS = 80;
const MAX_PLAY_DELTA = 0.1;

/**
 * Makes a film out of a job: shows any moment of it as a still, plays it in
 * real time, and writes it to a file frame by frame.
 */
export class FilmMaker {
  private film: LoadedFilm | undefined;
  private playHandle = 0;

  constructor(
    private readonly stage: FilmStage,
    private readonly recorders: FilmRecorderFactory,
    /** Where the place illustrations can be found as SVG symbols. */
    private readonly drawings: ParentNode,
  ) {}

  /** Loads a film and returns its storyboard. Nothing is drawn until a moment is asked for. */
  async load(job: FilmJob): Promise<Storyboard> {
    this.stop();
    const layout = layoutFor(job.format);
    const storyboard = new Storyboard(job.plan, job.template);
    const scenes = await SceneImages.load(
      this.drawings,
      job.plan.stops.map((stop) => stop.stop.scene),
    );
    this.stage.resize(job.format, PREVIEW_PIXEL_RATIO);
    const director = new FilmDirector(job.plan, storyboard, this.stage.view, layout.framing);
    await this.stage.view.prepare();
    const boarding = storyboard.shots.find((shot) => shot.kind === 'boarding');
    const painter = new FilmPainter(this.stage.brush, {
      layout,
      copy: job.copy,
      logo: job.logo,
      scenes,
      passSeconds: boarding?.seconds ?? 0,
    });
    this.film = { job, storyboard, director, painter };
    return storyboard;
  }

  /** Shows one moment of the film as a still picture. */
  showMoment(time: number): void {
    const film = this.film;
    if (!film) return;
    this.stop();
    film.director.rewind();
    const overlay = film.director.direct(time);
    this.stage.drawStill(() => film.painter.paint(overlay));
  }

  /** Plays the film on the canvas in real time from `from`; `onTime` follows its progress. */
  play(from: number, onTime: (time: number) => void, onEnd: () => void): void {
    const film = this.film;
    if (!film) return;
    this.showMoment(from);
    let time = from;
    let last = performance.now();
    const tick = (now: number): void => {
      const delta = Math.min((now - last) / 1000, MAX_PLAY_DELTA);
      last = now;
      time += delta;
      if (time >= film.storyboard.seconds) {
        this.playHandle = 0;
        onEnd();
        return;
      }
      const overlay = film.director.direct(time);
      this.stage.draw(delta, () => film.painter.paint(overlay));
      onTime(time);
      this.playHandle = requestAnimationFrame(tick);
    };
    this.playHandle = requestAnimationFrame(tick);
  }

  get playing(): boolean {
    return this.playHandle !== 0;
  }

  stop(): void {
    cancelAnimationFrame(this.playHandle);
    this.playHandle = 0;
  }

  /** Whether this browser can write the loaded film at the given settings. */
  async canExport(settings: ExportSettings): Promise<boolean> {
    const film = this.film;
    if (!film) return false;
    const support = await this.recorders.support(
      pixelSize(film.job.format, settings.quality),
      this.recorderSettings(film.job.format, settings, settings.sound),
    );
    return support.video;
  }

  /**
   * Writes the film to a file. Every frame is drawn for exactly its moment, so
   * the result is smooth however long a frame takes to make.
   */
  async export(
    output: HTMLCanvasElement,
    settings: ExportSettings,
    onProgress: (done: number, total: number) => void,
    signal: AbortSignal,
  ): Promise<ExportResult> {
    const film = this.film;
    if (!film) throw new Error('No film is loaded');
    this.stop();
    const { job, storyboard, director, painter } = film;
    const support = await this.recorders.support(
      pixelSize(job.format, settings.quality),
      this.recorderSettings(job.format, settings, settings.sound),
    );
    if (!support.video) throw new UnsupportedFilmError('This browser cannot encode this film');
    const hasSound = settings.sound && support.sound;

    this.stage.resize(job.format, settings.quality.pixelRatio);
    const recorder = await this.recorders.open(
      output,
      this.recorderSettings(job.format, settings, hasSound),
    );
    try {
      if (hasSound) {
        await recorder.addSound(await renderSoundtrack(soundCues(storyboard), storyboard.seconds));
      }
      const total = storyboard.frameCount(settings.frameRate);
      const step = 1 / settings.frameRate;
      // The film opens with the camera already at rest, not gliding into place.
      director.rewind();
      this.stage.drawStill(() => painter.paint(director.direct(0)));

      let breathed = performance.now();
      for (let frame = 0; frame < total; frame += 1) {
        signal.throwIfAborted();
        const time = frame * step;
        const overlay = director.direct(time);
        this.stage.draw(frame === 0 ? 0 : step, () => painter.paint(overlay));
        await recorder.addFrame(time, step);
        if (performance.now() - breathed > BREATHE_EVERY_MS) {
          onProgress(frame + 1, total);
          await yieldToMain();
          breathed = performance.now();
        }
      }
      onProgress(total, total);
      return { file: await recorder.finish(), hasSound };
    } catch (error) {
      await recorder.cancel();
      throw error;
    } finally {
      this.stage.resize(job.format, PREVIEW_PIXEL_RATIO);
    }
  }

  dispose(): void {
    this.stop();
    this.stage.dispose();
  }

  private recorderSettings(
    format: FilmFormat,
    settings: ExportSettings,
    sound: boolean,
  ): { frameRate: number; bitrate: number; sound: boolean } {
    return {
      frameRate: settings.frameRate,
      bitrate: bitrate(format, settings.quality, settings.frameRate),
      sound,
    };
  }
}
