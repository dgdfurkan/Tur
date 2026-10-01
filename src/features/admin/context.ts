import type { BookingService } from '@/application/BookingService';
import type { FaqEditor } from '@/application/FaqEditor';
import type { JourneyArchiveEditor } from '@/application/JourneyArchiveEditor';
import type { SiteSettingsService } from '@/application/SiteSettings';
import type { TourCatalogEditor } from '@/application/TourCatalogEditor';
import type { RestoreResult } from '@/infrastructure/backup/PanelBackup';
import type { ListExporter } from '@/infrastructure/export/ListExporter';
import type { Sheet } from './ui/Sheet';
import type { Toast } from './ui/Toast';

/** The tabs of the panel; every screen belongs to one of them. */
export type Section = 'ozet' | 'turlar' | 'yolcular' | 'site';

/** What every screen may use: the panel's services, its shared interface and navigation. */
export interface AppContext {
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
  /** Today's date as YYYY-MM-DD. */
  readonly today: string;
  readonly sheet: Sheet;
  readonly toast: Toast;
  /** Opens another screen; `replace` keeps the current one out of the back history. */
  go(path: string, options?: { readonly replace?: boolean }): void;
  /** Returns to the screen before this one, or to `fallback` when the panel was opened here. */
  back(fallback: string): void;
  /** Draws the current screen again after its data changed, where it was scrolled to. */
  refresh(): void;
  confirm(options: {
    readonly title: string;
    readonly text: string;
    readonly confirm: string;
    readonly danger?: boolean;
  }): Promise<boolean>;
  /** Offers a file made in the browser for download. */
  download(content: string, fileName: string, type: string): void;
}

/** A screen of the panel, built anew each time it is shown. */
export interface Screen {
  /** The tab it belongs to; a screen reached from several tabs stays in the one it was opened from. */
  readonly section?: Section;
  /** For the browser tab and for screen readers. */
  readonly title: string;
  /** Builds the screen. `entering` is true when it was navigated to rather than redrawn. */
  render(context: AppContext, entering: boolean): HTMLElement;
}

/** Turns an address inside the panel into the link that leads there. */
export const href = (path: string): string => `#${path}`;
