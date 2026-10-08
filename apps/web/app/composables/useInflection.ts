/**
 * Утилиты склонения слов (RU) и форматирования количественных фраз.
 * Работает корректно с отрицательными и дробными числами (берёт целую часть и модуль).
 *
 * Примеры:
 *  const { pluralize, verbForm, withCount } = useInflection()
 *  pluralize(1, ['товар', 'товара', 'товаров'])       -> 'товар'
 *  pluralize(3, ['товар', 'товара', 'товаров'])       -> 'товара'
 *  pluralize(12, ['товар', 'товара', 'товаров'])      -> 'товаров'
 *  verbForm(1, ['доступен', 'доступны'])              -> 'доступен'
 *  withCount(5, ['комментарий', 'комментария', 'комментариев'])
 *    -> '5 комментариев'
 */

export type PluralForms3 = [one: string, few: string, many: string];
export type VerbForms2 = [singular: string, plural: string];

export interface WithCountOptions {
  /**
   * Разделитель между числом и словом. По умолчанию — пробел.
   */
  sep?: string;
  /**
   * Показывать ли ноль (0 комментариев). По умолчанию — true.
   */
  showZero?: boolean;
}

export function useInflection() {
  /**
   * Нормализует число: берём модуль и целую часть.
   * Нужно, чтобы корректно обрабатывать -1, 1.2, -22.7 и т.п.
   */
  const normalize = (count: number) => Math.abs(Math.trunc(count));

  /**
   * Русские правила множественного числа (1 / 2-4 / 0,5-20 и остальное).
   * forms: [one, few, many] — например: ['товар', 'товара', 'товаров']
   */
  function pluralize(count: number, forms: PluralForms3): string {
    const n = normalize(count);
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }

  /**
   * Согласование глагола с количеством.
   * forms: [singular, plural] — например: ['доступен', 'доступны']
   * Используется строгая форма: 1 — единств., всё остальное — множ.
   */
  function verbForm(count: number, forms: VerbForms2): string {
    const n = normalize(count);
    return n === 1 ? forms[0] : forms[1];
  }

  /**
   * Удобный хелпер: вернёт строку вида "5 комментариев".
   */
  function withCount(count: number, forms: PluralForms3, options: WithCountOptions = {}): string {
    const { sep = ' ', showZero = true } = options;
    if (!showZero && Math.trunc(count) === 0) return '';
    return `${count}${sep}${pluralize(count, forms)}`.trim();
  }

  /**
   * Вариант с объектной записью форм (часто удобнее в словарях).
   * eq: { one: 'минута', few: 'минуты', many: 'минут' }
   */
  function pluralizeObj(count: number, forms: { one: string; few: string; many: string }): string {
    return pluralize(count, [forms.one, forms.few, forms.many]);
  }

  /**
   * Выбор подходящей формы по количеству, когда нужно просто слово.
   * Эквивалент pluralize, но позволяет передавать 2 формы тоже.
   */
  function chooseForm(count: number, forms: string[] | PluralForms3 | VerbForms2): string {
    if (forms.length === 2) return verbForm(count, forms as VerbForms2);
    return pluralize(count, forms as PluralForms3);
  }

  /**
   * Форматирование диапазона с правильными формами:
   * formatRange(1, 4, ['товар', 'товара', 'товаров']) -> "1–4 товара"
   */
  function formatRange(from: number, to: number, forms: PluralForms3, sep = '–'): string {
    const rightForm = pluralize(to, forms);
    return `${from}${sep}${to} ${rightForm}`;
  }

  /**
   * Сшивка глагола с фразой количества:
   * verbWithCount(3, ['доступен', 'доступны'], ['товар', 'товара', 'товаров'])
   * -> "доступны 3 товара"
   */
  function verbWithCount(count: number, verbForms: VerbForms2, nounForms: PluralForms3): string {
    return `${verbForm(count, verbForms)} ${withCount(count, nounForms)}`.trim();
  }

  return {
    pluralize,
    verbForm,
    withCount,
    pluralizeObj,
    chooseForm,
    formatRange,
    verbWithCount,
  };
}
