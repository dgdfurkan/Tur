import type { TourSnapshot } from '@/application/dto/TourData';
import { toTour } from '@/application/tourMapper';
import { tr } from '@/i18n/tr';
import { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { mp4Recorders } from '@/infrastructure/video/Mp4Recorder';
import { todayIso } from '@/shared/format';
import { mapChoice } from '@/shared/webgl';
import { FilmMaker } from './FilmMaker';
import { FilmStage } from './FilmStage';
import { FILM_FORMATS } from './formats';
import { LogoPicker } from './LogoPicker';
import { StudioApp } from './StudioApp';
import { StudioForm } from './StudioForm';

function find<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`The studio is missing ${selector}`);
  return element;
}

/** Composition root of the video studio. */
export async function mountStudio(root: HTMLElement): Promise<void> {
  const message = find<HTMLElement>(root, '[data-studio-message]');
  const unavailable = (text: string): void => {
    message.textContent = text;
    root.dataset['state'] = 'unavailable';
  };
  if (typeof VideoEncoder === 'undefined') {
    unavailable(tr.studio.noEncoder);
    return;
  }

  const tours = (
    JSON.parse(find<HTMLScriptElement>(root, '[data-tours]').textContent ?? '[]') as TourSnapshot[]
  ).map(toTour);
  const output = find<HTMLCanvasElement>(root, '[data-film-canvas]');
  const format = FILM_FORMATS[0];
  if (!format) throw new Error('There are no film formats');

  message.textContent = tr.studio.preparing;
  // The page's own typeface, so a film's lettering matches the site's.
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  await document.fonts.load(`700 16px ${family}`);
  const stage = await FilmStage.create(
    output,
    family,
    format,
    2,
    mapChoice(location.search) === '3d',
  );
  if (!stage) {
    unavailable(tr.studio.noGraphics);
    return;
  }

  const form = new StudioForm(
    find<HTMLFormElement>(root, '[data-studio-form]'),
    tours,
    new SafeStorage(),
  );
  const logos = new LogoPicker(
    find(root, 'input[name="logo"]'),
    find(root, '[data-action="remove-logo"]'),
    find(root, '[data-logo-error]'),
    { invalid: tr.studio.logoInvalid },
  );
  const maker = new FilmMaker(stage, mp4Recorders, document);
  await new StudioApp(root, output, form, logos, maker, mp4Recorders, todayIso()).start();
}
