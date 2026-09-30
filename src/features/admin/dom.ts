interface ElementOptions {
  readonly class?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string>>;
}

/**
 * Creates an element. Text always goes through `textContent`, so nothing a
 * user typed can ever be parsed as markup.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.class) element.className = options.class;
  if (options.text !== undefined) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

export function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Panel is missing ${selector}`);
  return element;
}
