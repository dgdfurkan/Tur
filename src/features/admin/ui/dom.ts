/** Anything that can stand in a list of children: falsy entries are skipped, strings become text. */
export type Child = Node | string | null | undefined | false;

type Handlers = Partial<{
  [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void;
}>;

interface ElementOptions {
  readonly class?: string | undefined;
  readonly text?: string | undefined;
  readonly attrs?: Readonly<Record<string, string | undefined>>;
  readonly on?: Handlers;
}

function append(parent: Element, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child);
  }
}

/**
 * Creates an element. Text always goes through `textContent` or text nodes,
 * so nothing a user typed can ever be parsed as markup. Attributes given as
 * undefined are left out.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.class) element.className = options.class;
  if (options.text !== undefined) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  for (const [type, handler] of Object.entries(options.on ?? {})) {
    element.addEventListener(type, handler as EventListener);
  }
  append(element, children);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an SVG element with attributes. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number>> = {},
  children: readonly Child[] = [],
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  append(element, children);
  return element;
}

export function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Panel is missing ${selector}`);
  return element;
}
