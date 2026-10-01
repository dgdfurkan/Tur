import type { BookingService } from '@/application/BookingService';
import type { FaqEditor } from '@/application/FaqEditor';
import type { JourneyArchiveEditor } from '@/application/JourneyArchiveEditor';
import type { SiteSettingsService } from '@/application/SiteSettings';
import type { TourCatalogEditor } from '@/application/TourCatalogEditor';
import { tr } from '@/i18n/tr';
import type { RestoreResult } from '@/infrastructure/backup/PanelBackup';
import type { ListExporter } from '@/infrastructure/export/ListExporter';
import type { AppContext, Screen, Section } from './context';
import { resolveRoute } from './routes';
import { confirmInSheet, Sheet } from './ui/Sheet';
import { Toast } from './ui/Toast';
import { transition } from './ui/motion';

export interface AdminServices {
  readonly bookings: BookingService;
  readonly catalog: TourCatalogEditor;
  readonly journeys: JourneyArchiveEditor;
  readonly faq: FaqEditor;
  readonly settings: SiteSettingsService;
  readonly exporter: ListExporter;
  readonly backup: {
    create(): string;
    restore(text: string): RestoreResult;
  };
  readonly today: string;
}

const SECTIONS: readonly Section[] = ['ozet', 'turlar', 'yolcular', 'site'];

function currentPath(): string {
  const path = decodeURI(location.hash.replace(/^#/, ''));
  return path.startsWith('/') ? path : '/';
}

const depthOf = (path: string): number =>
  path.split('?')[0]?.split('/').filter(Boolean).length ?? 0;

/**
 * The operations panel as an app: it reads the address after the #, builds
 * the screen it names and moves between screens the way a phone app does.
 * Screens hold no state of their own beyond what is typed into a form; they
 * are rebuilt from the services whenever something changes.
 */
export class AdminApp implements AppContext {
  readonly bookings: BookingService;
  readonly catalog: TourCatalogEditor;
  readonly journeys: JourneyArchiveEditor;
  readonly faq: FaqEditor;
  readonly settings: SiteSettingsService;
  readonly exporter: ListExporter;
  readonly backup: AdminServices['backup'];
  readonly today: string;
  readonly sheet: Sheet;
  readonly toast: Toast;

  private current: { path: string; screen: Screen; section: Section } | null = null;
  /** The addresses visited in this tab, so going back knows where it leads. */
  private readonly trail: string[] = [];
  private readonly scrolls = new Map<string, number>();
  private readonly navLinks: HTMLAnchorElement[];

  constructor(
    private readonly root: HTMLElement,
    private readonly host: HTMLElement,
    services: AdminServices,
  ) {
    this.bookings = services.bookings;
    this.catalog = services.catalog;
    this.journeys = services.journeys;
    this.faq = services.faq;
    this.settings = services.settings;
    this.exporter = services.exporter;
    this.backup = services.backup;
    this.today = services.today;
    this.sheet = new Sheet(root);
    this.toast = new Toast(root);
    this.navLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  }

  start(): void {
    addEventListener('hashchange', () => this.route());
    // The back arrow of a screen returns through the history, as a phone's back gesture does.
    this.host.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('.topbar__back') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      event.preventDefault();
      this.back(link.hash.replace(/^#/, '') || '/');
    });
    // Another tab of the panel changed the records: show them.
    addEventListener('storage', () => {
      this.catalog.reload();
      this.journeys.reload();
      if (!this.sheet.isOpen) this.refresh();
    });
    this.route();
    this.root.dataset['ready'] = 'true';
  }

  go(path: string, options: { readonly replace?: boolean } = {}): void {
    if (options.replace) {
      // The replaced screen leaves the trail too, so going back skips it.
      this.trail.pop();
      history.replaceState(null, '', `#${path}`);
      this.route();
    } else {
      location.hash = path;
    }
  }

  back(fallback: string): void {
    if (this.trail.length > 1) history.back();
    else this.go(fallback, { replace: true });
  }

  refresh(): void {
    if (!this.current) return;
    const scroll = scrollY;
    this.mount(this.current.screen, false);
    scrollTo({ top: scroll, behavior: 'instant' });
  }

  confirm(options: Parameters<AppContext['confirm']>[0]): Promise<boolean> {
    return confirmInSheet(this.sheet, options);
  }

  download(content: string, fileName: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // The click starts the download synchronously; the URL is not needed after it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private route(): void {
    const path = currentPath();
    const screen = resolveRoute(path, this);
    if (!screen) {
      this.go('/', { replace: true });
      return;
    }
    void this.sheet.close({ instant: true });
    const previous = this.current;
    if (previous) this.scrolls.set(previous.path, scrollY);

    const returning = this.trail.at(-2) === path;
    if (returning) this.trail.pop();
    else if (this.trail.at(-1) !== path) this.trail.push(path);

    const section = screen.section ?? previous?.section ?? 'ozet';
    const direction =
      previous === null
        ? 'none'
        : previous.section !== section
          ? 'tab'
          : returning || depthOf(path) < depthOf(previous.path)
            ? 'pop'
            : 'push';
    this.current = { path, screen, section };

    transition(direction, () => {
      this.mount(screen, true);
      // Going back returns to where the list was left; anything else starts at the top.
      const top = direction === 'pop' ? (this.scrolls.get(path) ?? 0) : 0;
      scrollTo({ top, behavior: 'instant' });
      // Keyboard and screen reader users land on the title of what they opened.
      if (previous) this.host.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    });
    document.title = `${screen.title} | ${tr.admin.title}`;
    this.markSection(section);
  }

  private mount(screen: Screen, entering: boolean): void {
    this.host.replaceChildren(screen.render(this, entering));
  }

  private markSection(section: Section): void {
    for (const link of this.navLinks) {
      if (link.dataset['nav'] === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    this.root.style.setProperty('--nav-index', String(SECTIONS.indexOf(section)));
  }
}
