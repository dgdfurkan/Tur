import type { SceneKey } from '@/domain/tour/Tour';

const VIEW = { width: 320, height: 200 };
/** Drawn large, so a place card stays sharp on a 4K frame. */
const RASTER_SCALE = 6.5;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The place illustrations as images a canvas can draw. They are the same SVG
 * symbols the pages use, read from the document and loaded as pictures.
 */
export class SceneImages {
  readonly size = VIEW;
  private readonly images = new Map<SceneKey, HTMLImageElement>();

  /** Loads the drawings of the given scenes; symbols missing from the page are skipped. */
  static async load(scope: ParentNode, keys: Iterable<SceneKey>): Promise<SceneImages> {
    const gallery = new SceneImages();
    const serializer = new XMLSerializer();
    await Promise.all(
      [...new Set(keys)].map(async (key) => {
        const symbol = scope.querySelector(`#scene-${key}`);
        if (!symbol) return;
        const drawing = [...symbol.childNodes]
          .map((node) => serializer.serializeToString(node))
          .join('');
        const svg =
          `<svg xmlns="${SVG_NS}" viewBox="0 0 ${VIEW.width} ${VIEW.height}" ` +
          `width="${VIEW.width * RASTER_SCALE}" height="${VIEW.height * RASTER_SCALE}">${drawing}</svg>`;
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await image.decode();
        gallery.images.set(key, image);
      }),
    );
    return gallery;
  }

  get(key: SceneKey): HTMLImageElement | undefined {
    return this.images.get(key);
  }
}
