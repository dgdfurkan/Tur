import { FAQ_TOPICS, type FaqEntry, type FaqTopic } from '@/application/dto/faqSchema';
import { pageUrl } from '@/config/paths';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/shared/format';
import type { AppContext, Screen } from '../context';
import { el } from '../ui/dom';
import { block, button, chip, field, group, iconButton, row, screen } from '../ui/kit';
import { tap } from '../ui/motion';
import { attempt } from './editSheets';

/** The questions of the site by topic: each opens to be changed and moves within its topic. */
export function faqScreen(): Screen {
  return {
    section: 'site',
    title: tr.admin.faq.title,
    render(context: AppContext) {
      const items = context.faq.items();
      const move = (id: string, by: -1 | 1): void => {
        context.faq.move(id, by);
        tap();
        context.refresh();
        context.toast.show(tr.admin.faq.moved);
      };
      const topics = FAQ_TOPICS.map((topic) => {
        const inTopic = items.filter((item) => item.topic === topic);
        return block(tr.faq.topics[topic], [
          inTopic.length === 0
            ? el('p', { class: 'block__empty', text: tr.admin.faq.empty })
            : group(
                inTopic.map((item, index) =>
                  el('div', { class: 'row row--item' }, [
                    el(
                      'button',
                      {
                        class: 'row__main',
                        attrs: { type: 'button' },
                        on: { click: () => editQuestion(context, item, topic) },
                      },
                      [
                        el('span', { class: 'row__text' }, [
                          el('span', { class: 'row__title', text: item.question }),
                          el('span', { class: 'row__subtitle', text: item.answer }),
                          item.featured
                            ? el('span', { class: 'row__chips' }, [
                                chip(tr.admin.faq.featuredChip, 'blue'),
                              ])
                            : null,
                        ]),
                      ],
                    ),
                    el('span', { class: 'row__tools' }, [
                      index > 0
                        ? iconButton({
                            icon: 'arrowUp',
                            label: tr.admin.list.moveUp,
                            onClick: () => move(item.id, -1),
                          })
                        : null,
                      index < inTopic.length - 1
                        ? iconButton({
                            icon: 'arrowDown',
                            label: tr.admin.list.moveDown,
                            onClick: () => move(item.id, 1),
                          })
                        : null,
                    ]),
                  ]),
                ),
              ),
        ]);
      });

      return screen(
        {
          title: tr.admin.faq.title,
          subtitle: tr.admin.faq.subtitle(formatNumber(items.length)),
          back: { href: '#/site', label: tr.admin.nav.site },
          actions: [
            iconButton({ icon: 'external', label: tr.admin.faq.openOnSite, href: pageUrl('sss') }),
          ],
        },
        [
          context.faq.isStale()
            ? el('div', { class: 'notice' }, [
                el('p', { text: tr.admin.faq.stale }),
                button({
                  label: tr.admin.faq.useSite,
                  variant: 'secondary',
                  onClick: () => {
                    context.faq.discard();
                    context.refresh();
                  },
                }),
              ])
            : null,
          ...topics,
          button({
            label: tr.admin.faq.add,
            icon: 'plus',
            variant: 'tonal',
            block: true,
            onClick: () => editQuestion(context, null, 'rezervasyon'),
          }),
          context.faq.isChanged()
            ? block(
                null,
                [
                  group([
                    row({
                      title: tr.admin.faq.discard,
                      icon: { name: 'refresh', tone: 'red' },
                      danger: true,
                      onClick: () =>
                        void context
                          .confirm({
                            title: tr.admin.faq.discard,
                            text: tr.admin.faq.discardText,
                            confirm: tr.admin.faq.discard,
                            danger: true,
                          })
                          .then((yes) => {
                            if (!yes) return;
                            context.faq.discard();
                            context.refresh();
                            context.toast.show(tr.admin.faq.discarded);
                          }),
                    }),
                  ]),
                ],
                { footnote: tr.admin.faq.changedNote },
              )
            : null,
        ],
      );
    },
  };
}

/** A question and its answer, its topic and whether it is shown beyond the questions page. */
function editQuestion(context: AppContext, item: FaqEntry | null, topic: FaqTopic): void {
  const question = el('input', {
    attrs: { type: 'text', maxlength: '120', autocomplete: 'off', enterkeyhint: 'next' },
  });
  const answer = el('textarea', { attrs: { rows: '5', maxlength: '600' } });
  const topicSelect = el(
    'select',
    {},
    FAQ_TOPICS.map((value) => el('option', { text: tr.faq.topics[value], attrs: { value } })),
  );
  const featured = el('input', {
    class: 'switch__input',
    attrs: { type: 'checkbox', role: 'switch' },
  });
  question.value = item?.question ?? '';
  answer.value = item?.answer ?? '';
  topicSelect.value = item?.topic ?? topic;
  featured.checked = item?.featured ?? false;

  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '', id: 'faq-form' } }, [
    field({ label: tr.admin.faq.question, control: question, hint: tr.admin.faq.questionHint }),
    field({ label: tr.admin.faq.answer, control: answer }),
    field({ label: tr.admin.faq.topic, control: topicSelect }),
    el('label', { class: 'row row--toggle row--plain' }, [
      el('span', { class: 'row__text' }, [
        el('span', { class: 'row__title', text: tr.admin.faq.featured }),
        el('span', { class: 'row__subtitle', text: tr.admin.faq.featuredHint }),
      ]),
      el('span', { class: 'switch' }, [
        featured,
        el('span', { class: 'switch__track', attrs: { 'aria-hidden': 'true' } }),
      ]),
    ]),
    error,
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (question.value.trim() === '' || answer.value.trim() === '') {
      error.textContent = tr.admin.ui.required;
      return;
    }
    const chosen = FAQ_TOPICS.find((value) => value === topicSelect.value) ?? topic;
    const data = {
      question: question.value.trim(),
      answer: answer.value.trim(),
      topic: chosen,
      featured: featured.checked,
    };
    attempt(
      context,
      error,
      () => {
        if (item) context.faq.update(item.id, data);
        else context.faq.add(data);
      },
      item ? tr.admin.faq.saved : tr.admin.faq.added,
    );
  });

  context.sheet.open({
    title: item ? tr.admin.faq.edit : tr.admin.faq.add,
    body: [form],
    footer: [
      button({
        label: tr.admin.ui.save,
        type: 'submit',
        size: 'lg',
        block: true,
        attrs: { form: 'faq-form' },
      }),
      item
        ? button({
            label: tr.admin.faq.remove,
            variant: 'danger',
            block: true,
            onClick: () =>
              attempt(context, error, () => context.faq.remove(item.id), tr.admin.faq.removed),
          })
        : null,
    ],
  });
}
