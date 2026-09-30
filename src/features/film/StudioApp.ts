import { RoutePlan } from '@/domain/tour/RoutePlan';
import { tr } from '@/i18n/tr';
import { formatSeconds } from '@/shared/format';
import { filmCopy } from './FilmCopy';
import { UnsupportedFilmError, type FilmMaker } from './FilmMaker';
import type { FilmRecorderFactory } from './FilmRecorder';
import { pixelSize } from './formats';
import type { LogoPicker } from './LogoPicker';
import type { Storyboard } from './Storyboard';
import type { StudioChoice, StudioForm } from './StudioForm';

type StudioState = 'loading' | 'ready' | 'playing' | 'exporting' | 'done' | 'unavailable';

/** Where the still stands when a film is first loaded: the title sign, fully arrived. */
const OPENING_MOMENT = 1.4;

function find<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`The studio is missing ${selector}`);
  return element;
}

/**
 * The video studio's screen: it turns the settings form into a film, lets the
 * film be scrubbed and played, and writes it to a file to download.
 */
export class StudioApp {
  private readonly position: HTMLInputElement;
  private readonly time: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly message: HTMLElement;
  private readonly previewLabel: HTMLElement;
  private readonly progress: HTMLProgressElement;
  private readonly progressText: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly download: HTMLAnchorElement;
  private storyboard: Storyboard | undefined;
  private abort: AbortController | undefined;
  private fileUrl: string | undefined;
  /** Counts loads, so a slow one that has been overtaken by a newer one is dropped. */
  private loads = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly output: HTMLCanvasElement,
    private readonly form: StudioForm,
    private readonly logos: LogoPicker,
    private readonly maker: FilmMaker,
    private readonly recorders: FilmRecorderFactory,
    private readonly today: string,
  ) {
    this.position = find(root, '[data-position]');
    this.time = find(root, '[data-time]');
    this.summary = find(root, '[data-summary]');
    this.message = find(root, '[data-studio-message]');
    this.previewLabel = find(root, '[data-preview-label]');
    this.progress = find(root, '[data-progress] progress');
    this.progressText = find(root, '[data-progress-text]');
    this.video = find(root, '[data-film-video]');
    this.download = find(root, '[data-download]');

    form.onChange(() => void this.load());
    logos.onChange(() => void this.load());
    this.position.addEventListener('input', () => this.scrub());
    find<HTMLButtonElement>(root, '[data-action="preview"]').addEventListener('click', () =>
      this.togglePreview(),
    );
    find<HTMLButtonElement>(root, '[data-action="create"]').addEventListener(
      'click',
      () => void this.create(),
    );
    find<HTMLButtonElement>(root, '[data-action="cancel"]').addEventListener('click', () =>
      this.abort?.abort(),
    );
    find<HTMLButtonElement>(root, '[data-action="again"]').addEventListener('click', () => {
      this.releaseFile();
      this.setState('ready');
      this.scrub();
    });
    addEventListener('pagehide', () => this.maker.dispose(), { once: true });
  }

  async start(): Promise<void> {
    await this.load();
  }

  private get state(): StudioState {
    return this.root.dataset['state'] as StudioState;
  }

  private setState(state: StudioState): void {
    this.root.dataset['state'] = state;
    this.form.setDisabled(state === 'exporting');
    this.previewLabel.textContent = state === 'playing' ? tr.studio.stopPreview : tr.studio.preview;
  }

  /** Builds the film the form describes and shows its opening. */
  private async load(): Promise<void> {
    if (this.state === 'exporting') return;
    const load = (this.loads += 1);
    const choice = this.form.read();
    this.releaseFile();
    this.root.dataset['format'] = choice.format.id;
    const storyboard = await this.maker.load(this.jobFor(choice));
    if (load !== this.loads) return;
    this.storyboard = storyboard;

    const { width, height } = pixelSize(choice.format, choice.quality);
    this.summary.textContent = tr.studio.summary(formatSeconds(storyboard.seconds), width, height);
    this.position.max = storyboard.seconds.toFixed(1);
    this.position.value = String(Math.min(OPENING_MOMENT, storyboard.seconds));
    this.message.textContent = '';
    this.setState('ready');
    this.scrub();
  }

  private jobFor(choice: StudioChoice): Parameters<FilmMaker['load']>[0] {
    const { tour, template, day } = choice;
    const plan = template === 'day' ? RoutePlan.forDay(tour, day) : RoutePlan.fromTour(tour);
    return {
      plan,
      template,
      format: choice.format,
      logo: this.logos.current,
      copy: filmCopy(tour, plan, template, choice, this.today, day),
    };
  }

  private scrub(): void {
    const time = Number(this.position.value);
    this.showTime(time);
    if (this.state === 'playing') this.setState('ready');
    this.maker.showMoment(time);
  }

  private showTime(time: number): void {
    this.time.textContent = `${time.toFixed(1).replace('.', ',')} sn`;
  }

  private togglePreview(): void {
    if (this.state === 'playing') {
      this.maker.stop();
      this.setState('ready');
      return;
    }
    if (this.state !== 'ready' || !this.storyboard) return;
    // Pressing play at the end starts again from the beginning.
    const from =
      Number(this.position.value) >= this.storyboard.seconds - 0.2
        ? 0
        : Number(this.position.value);
    this.setState('playing');
    this.maker.play(
      from,
      (time) => {
        this.position.value = time.toFixed(1);
        this.showTime(time);
      },
      () => this.setState('ready'),
    );
  }

  /** Writes the film to a file and offers it for download. */
  private async create(): Promise<void> {
    if ((this.state !== 'ready' && this.state !== 'playing') || !this.storyboard) return;
    const choice = this.form.read();
    this.maker.stop();
    this.abort = new AbortController();
    this.progress.value = 0;
    this.progressText.textContent = '';
    this.message.textContent = tr.studio.encoding;
    this.setState('exporting');
    try {
      const { file, hasSound } = await this.maker.export(
        this.output,
        choice,
        (done, total) => {
          this.progress.value = done / total;
          this.progressText.textContent = tr.studio.progress(done, total);
        },
        this.abort.signal,
      );
      this.offer(file, choice);
      this.message.textContent =
        choice.sound && !hasSound ? `${tr.studio.done} ${tr.studio.noSound}` : tr.studio.done;
      this.setState('done');
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      this.message.textContent = cancelled
        ? tr.studio.cancelled
        : error instanceof UnsupportedFilmError
          ? tr.studio.noQuality
          : tr.studio.failed;
      if (!cancelled && !(error instanceof UnsupportedFilmError)) console.error(error);
      this.setState('ready');
      this.scrub();
    }
  }

  private offer(file: Blob, choice: StudioChoice): void {
    this.releaseFile();
    this.fileUrl = URL.createObjectURL(file);
    const parts = [
      choice.tour.id,
      choice.template === 'day' ? `gun-${choice.day}` : choice.template,
      choice.format.id,
      choice.quality.id,
    ];
    this.download.href = this.fileUrl;
    this.download.download = `${parts.join('-')}.${this.recorders.extension}`;
    this.video.src = this.fileUrl;
  }

  private releaseFile(): void {
    if (!this.fileUrl) return;
    this.video.removeAttribute('src');
    this.video.load();
    this.download.removeAttribute('href');
    URL.revokeObjectURL(this.fileUrl);
    this.fileUrl = undefined;
  }
}
