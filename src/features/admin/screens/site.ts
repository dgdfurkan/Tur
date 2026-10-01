import { InvalidSettingsError, type SiteSettings } from '@/application/SiteSettings';
import { pageUrl } from '@/config/paths';
import { tr } from '@/i18n/tr';
import { formatNumber, todayIso } from '@/shared/format';
import { href, type AppContext, type Screen } from '../context';
import { loadSamples } from '../sampleData';
import { el } from '../ui/dom';
import { block, button, group, icon, row, scene, screen, toggleRow } from '../ui/kit';
import { tap } from '../ui/motion';
import { editText } from './editSheets';

type TextKey = {
  [K in keyof SiteSettings]: SiteSettings[K] extends string ? K : never;
}[keyof SiteSettings];

/** Changes one setting through a text sheet; a refused value keeps the sheet open. */
function settingRow(
  context: AppContext,
  key: TextKey,
  options: {
    readonly title: string;
    readonly icon: Parameters<typeof row>[0]['icon'];
    readonly multiline?: boolean;
    readonly maxLength?: number;
    readonly required?: boolean;
    readonly hint?: string;
    readonly inputMode?: 'text' | 'tel' | 'email';
    readonly showValue?: 'subtitle' | 'value';
  },
): HTMLElement {
  const value = context.settings.get()[key];
  const shown = value === '' ? tr.admin.site.notSet : value;
  return row({
    title: options.title,
    ...(options.showValue === 'value' ? { value: shown } : { subtitle: shown }),
    icon: options.icon,
    onClick: () =>
      editText(context, {
        title: options.title,
        label: options.title,
        value,
        multiline: options.multiline ?? false,
        maxLength: options.maxLength ?? 120,
        required: options.required ?? false,
        ...(options.hint ? { hint: options.hint } : {}),
        ...(options.inputMode ? { inputMode: options.inputMode } : {}),
        save: (next) => {
          try {
            context.settings.update({ [key]: next });
          } catch (problem) {
            if (problem instanceof InvalidSettingsError) {
              throw new RangeError(problem.message, { cause: problem });
            }
            throw problem;
          }
        },
      }),
  });
}

/** How the home page will read, drawn small in the panel. */
function homePreview(settings: SiteSettings): HTMLElement {
  return el('div', { class: 'preview', attrs: { 'aria-hidden': 'true' } }, [
    settings.announcementOn && settings.announcementText
      ? el('p', { class: 'preview__band', text: settings.announcementText })
      : null,
    el('div', { class: 'preview__hero' }, [
      el('strong', { class: 'preview__title', text: settings.heroTitle }),
      el('span', { class: 'preview__lead', text: settings.heroLead }),
    ]),
    el('div', { class: 'preview__land' }, [scene('uc-guzeller', 'scene', 'bottom')]),
  ]);
}

/** The site's own settings, the records on this device and the panel itself. */
export function siteScreen(): Screen {
  return {
    section: 'site',
    title: tr.admin.nav.site,
    render(context: AppContext) {
      const settings = context.settings.get();
      const changedTours = context.catalog
        .tours()
        .filter((tour) => context.catalog.isChanged(tour.id)).length;
      const hidden = settings.hiddenTourIds.length;

      const restoreInput = el('input', {
        class: 'visually-hidden',
        attrs: {
          type: 'file',
          accept: 'application/json,.json',
          tabindex: '-1',
          'aria-hidden': 'true',
        },
      });
      restoreInput.addEventListener('change', () => {
        const file = restoreInput.files?.[0];
        restoreInput.value = '';
        if (!file) return;
        void file.text().then(async (text) => {
          const yes = await context.confirm({
            title: tr.admin.data.restore,
            text: tr.admin.data.restoreText,
            confirm: tr.admin.data.restore,
            danger: true,
          });
          if (!yes) return;
          const result = context.backup.restore(text);
          context.catalog.reload();
          context.refresh();
          context.toast.show(
            result.ok
              ? tr.admin.data.restored(formatNumber(result.passengers), formatNumber(result.tours))
              : tr.admin.data.restoreFailed,
          );
        });
      });

      return screen({ title: tr.admin.nav.site, subtitle: tr.admin.site.subtitle }, [
        el('div', { class: 'card status' }, [
          el('span', { class: 'tile tile--blue' }, [icon('database', 18)]),
          el('div', { class: 'status__text' }, [
            el('strong', { text: tr.admin.site.statusTitle }),
            el('p', { text: tr.admin.site.statusText }),
            el('p', {
              class: 'status__figures',
              text: tr.admin.site.statusFigures(formatNumber(changedTours), formatNumber(hidden)),
            }),
          ]),
        ]),

        block(tr.admin.site.home, [
          homePreview(settings),
          group([
            settingRow(context, 'heroTitle', {
              title: tr.admin.site.heroTitle,
              icon: { name: 'home', tone: 'blue' },
              maxLength: 80,
              required: true,
            }),
            settingRow(context, 'heroLead', {
              title: tr.admin.site.heroLead,
              icon: { name: 'list', tone: 'blue' },
              multiline: true,
              maxLength: 320,
              required: true,
            }),
          ]),
          group([
            toggleRow({
              title: tr.admin.site.announcement,
              subtitle: tr.admin.site.announcementHint,
              checked: settings.announcementOn,
              icon: { name: 'megaphone', tone: 'yellow' },
              onChange: (on) => {
                context.settings.update({ announcementOn: on });
                tap();
                context.refresh();
              },
            }),
            settingRow(context, 'announcementText', {
              title: tr.admin.site.announcementText,
              icon: { name: 'pencil', tone: 'yellow' },
              maxLength: 160,
              multiline: true,
            }),
          ]),
        ]),

        block(tr.admin.site.tours, [
          group([
            row({
              title: tr.admin.site.shownTours,
              value: tr.admin.site.shownCount(
                formatNumber(context.catalog.tours().length - hidden),
                formatNumber(context.catalog.tours().length),
              ),
              icon: { name: 'eye', tone: 'green' },
              href: href('/site/turlar'),
            }),
          ]),
        ]),

        block(tr.admin.site.contact, [
          group([
            settingRow(context, 'phone', {
              title: tr.contact.phone,
              icon: { name: 'phone', tone: 'green' },
              inputMode: 'tel',
              maxLength: 30,
              showValue: 'value',
            }),
            settingRow(context, 'whatsapp', {
              title: tr.contact.whatsapp,
              icon: { name: 'message', tone: 'green' },
              inputMode: 'tel',
              maxLength: 30,
              showValue: 'value',
            }),
            settingRow(context, 'email', {
              title: tr.contact.email,
              icon: { name: 'mail', tone: 'blue' },
              inputMode: 'email',
              maxLength: 120,
              showValue: 'value',
            }),
            settingRow(context, 'instagram', {
              title: tr.admin.site.instagram,
              icon: { name: 'image', tone: 'brown' },
              maxLength: 31,
              hint: tr.admin.site.instagramHint,
              showValue: 'value',
            }),
            settingRow(context, 'address', {
              title: tr.contact.address,
              icon: { name: 'pin', tone: 'blue' },
              multiline: true,
              maxLength: 200,
            }),
            settingRow(context, 'hours', {
              title: tr.contact.hours,
              icon: { name: 'clock', tone: 'blue' },
              maxLength: 120,
            }),
          ]),
        ]),

        block(tr.admin.site.brand, [
          group([
            settingRow(context, 'brandName', {
              title: tr.admin.site.brandName,
              icon: { name: 'ticket', tone: 'blue' },
              maxLength: 60,
              required: true,
              showValue: 'value',
            }),
            settingRow(context, 'tursabNumber', {
              title: tr.admin.site.tursab,
              icon: { name: 'shield', tone: 'blue' },
              maxLength: 20,
              showValue: 'value',
            }),
          ]),
        ]),

        block(tr.admin.data.title, [
          group([
            row({
              title: tr.admin.data.backup,
              subtitle: tr.admin.data.backupHint,
              icon: { name: 'download', tone: 'blue' },
              onClick: () => {
                context.download(
                  context.backup.create(),
                  `panel-yedegi-${todayIso()}.json`,
                  'application/json',
                );
                context.toast.show(tr.admin.data.backedUp);
              },
            }),
            row({
              title: tr.admin.data.restore,
              subtitle: tr.admin.data.restoreHint,
              icon: { name: 'upload', tone: 'blue' },
              onClick: () => restoreInput.click(),
            }),
            row({
              title: tr.admin.data.samples,
              subtitle: tr.admin.data.samplesHint,
              icon: { name: 'users', tone: 'grey' },
              onClick: () => {
                const added = loadSamples(context.bookings, context.today);
                context.refresh();
                context.toast.show(tr.admin.data.samplesLoaded(formatNumber(added)));
              },
            }),
            row({
              title: tr.admin.data.reset,
              icon: { name: 'trash', tone: 'red' },
              danger: true,
              onClick: () =>
                void context
                  .confirm({
                    title: tr.admin.data.reset,
                    text: tr.admin.data.resetText,
                    confirm: tr.admin.data.reset,
                    danger: true,
                  })
                  .then((yes) => {
                    if (!yes) return;
                    context.bookings.clear();
                    for (const tour of context.catalog.tours()) context.catalog.discard(tour.id);
                    context.settings.reset();
                    context.refresh();
                    context.toast.show(tr.admin.data.cleared);
                  }),
            }),
          ]),
          restoreInput,
        ]),

        block(tr.admin.site.panel, [
          group([
            row({
              title: tr.admin.site.openSite,
              icon: { name: 'external', tone: 'grey' },
              href: pageUrl(),
              accessory: el('span', { class: 'row__chevron' }, [icon('external', 18)]),
            }),
            row({
              title: tr.admin.site.lock,
              icon: { name: 'lock', tone: 'grey' },
              // The lock button of the frame forgets the key and reloads the page.
              onClick: () =>
                document.querySelector<HTMLButtonElement>('[data-action="lock"]')?.click(),
            }),
          ]),
        ]),
      ]);
    },
  };
}

/** Which tours the site lists; a hidden tour keeps its page but leaves every list. */
export function shownToursScreen(): Screen {
  return {
    section: 'site',
    title: tr.admin.site.shownTours,
    render(context: AppContext) {
      return screen(
        { title: tr.admin.site.shownTours, back: { href: '#/site', label: tr.admin.nav.site } },
        [
          group(
            context.catalog.tours().map((tour) =>
              toggleRow({
                title: tour.title,
                subtitle: tour.destination,
                checked: !context.settings.isTourHidden(tour.id),
                onChange: (shown) => {
                  context.settings.setTourHidden(tour.id, !shown);
                  tap();
                  context.toast.show(shown ? tr.admin.tour.shown : tr.admin.tour.hiddenNow);
                },
              }),
            ),
          ),
          el('p', { class: 'block__foot', text: tr.admin.site.shownNote }),
          button({ label: tr.admin.nav.tours, variant: 'tonal', href: href('/turlar') }),
        ],
      );
    },
  };
}
