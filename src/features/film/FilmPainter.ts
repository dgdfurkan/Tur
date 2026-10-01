import type { FilmCopy } from './FilmCopy';
import type { FilmLayout } from './FilmLayout';
import type { FilmOverlay } from './FilmOverlay';
import { BrandPainter } from './paint/BrandPainter';
import type { Brush } from './paint/Brush';
import { HeadingPainter } from './paint/HeadingPainter';
import type { Logo } from './paint/Logo';
import { PassPainter } from './paint/PassPainter';
import { PlaceCardPainter } from './paint/PlaceCardPainter';
import { SignPainter } from './paint/SignPainter';
import type { SceneImages } from './SceneImages';

export interface FilmLook {
  readonly layout: FilmLayout;
  readonly copy: FilmCopy;
  readonly logo: Logo;
  readonly scenes: SceneImages;
  /** Length of the boarding pass scene, or 0 when the film has none. */
  readonly passSeconds: number;
}

/**
 * Paints everything that lies over the map in a film frame. Each part has a
 * painter of its own; this only decides which of them a moment calls for.
 */
export class FilmPainter {
  private readonly brand: BrandPainter;
  private readonly heading: HeadingPainter;
  private readonly place: PlaceCardPainter;
  private readonly signs: SignPainter;
  private readonly pass: PassPainter;

  constructor(brush: Brush, look: FilmLook) {
    const { layout, copy, logo, scenes } = look;
    this.brand = new BrandPainter(brush, layout, copy, logo);
    this.heading = new HeadingPainter(brush, layout);
    this.place = new PlaceCardPainter(brush, layout, scenes);
    this.signs = new SignPainter(brush, layout, copy, logo);
    this.pass = new PassPainter(brush, layout.format, copy, logo, look.passSeconds);
  }

  paint(overlay: FilmOverlay): void {
    if (overlay.brand > 0) this.brand.paint(overlay.brand, overlay.day);
    if (overlay.heading) this.heading.paint(overlay.heading);
    if (overlay.place) this.place.paint(overlay.place);
    if (overlay.title > 0) this.signs.title(overlay.title);
    if (overlay.outro > 0) this.signs.outro(overlay.outro);
    if (overlay.pass !== null) this.pass.paint(overlay.pass);
  }
}
