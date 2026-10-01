import { BrandMarkLogo, ImageLogo, type Logo } from './paint/Logo';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(new Error('The file could not be read')));
    reader.readAsDataURL(file);
  });
}

/**
 * Lets the maker of a film choose a logo file. The picture never leaves the
 * device: it is decoded in the browser and drawn onto the frames.
 */
export class LogoPicker {
  private logo: Logo = new BrandMarkLogo();

  constructor(
    private readonly input: HTMLInputElement,
    private readonly removeButton: HTMLButtonElement,
    private readonly error: HTMLElement,
    private readonly messages: { readonly invalid: string },
  ) {}

  get current(): Logo {
    return this.logo;
  }

  onChange(callback: () => void): void {
    this.input.addEventListener('change', () => {
      void this.take(this.input.files?.[0]).then(callback);
    });
    this.removeButton.addEventListener('click', () => {
      this.input.value = '';
      this.use(new BrandMarkLogo(), false);
      callback();
    });
  }

  private async take(file: File | undefined): Promise<void> {
    this.error.textContent = '';
    if (!file) return;
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) {
      this.reject();
      return;
    }
    try {
      // Decoding through an image element also handles SVG, which createImageBitmap cannot read from a file.
      const image = new Image();
      image.src = await readAsDataUrl(file);
      await image.decode();
      const size = Math.max(image.naturalWidth, image.naturalHeight) || 512;
      const scale = Math.min(1, 1024 / size);
      this.use(
        new ImageLogo(
          await createImageBitmap(image, {
            resizeWidth: Math.max(1, Math.round((image.naturalWidth || 512) * scale)),
            resizeHeight: Math.max(1, Math.round((image.naturalHeight || 512) * scale)),
            resizeQuality: 'high',
          }),
        ),
        true,
      );
    } catch {
      this.reject();
    }
  }

  private use(logo: Logo, custom: boolean): void {
    this.logo = logo;
    this.removeButton.hidden = !custom;
  }

  private reject(): void {
    this.input.value = '';
    this.error.textContent = this.messages.invalid;
  }
}
