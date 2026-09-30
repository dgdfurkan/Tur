/**
 * Lets cards lean towards the pointer. Each card marked `data-tilt` gets two
 * custom properties, from -0.5 to 0.5, saying where the pointer is across and
 * down it; the card's own styles decide what to do with them. Touch screens
 * and visitors who prefer reduced motion are left alone.
 */
export function enableTilt(root: ParentNode = document): void {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

  for (const card of root.querySelectorAll<HTMLElement>('[data-tilt]')) {
    let frame = 0;
    let pointer: PointerEvent | undefined;
    card.addEventListener('pointermove', (event) => {
      pointer = event;
      // At most one update per frame, however often the pointer reports.
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        if (!pointer) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty(
          '--tilt-x',
          ((pointer.clientX - box.left) / box.width - 0.5).toFixed(3),
        );
        card.style.setProperty(
          '--tilt-y',
          ((pointer.clientY - box.top) / box.height - 0.5).toFixed(3),
        );
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer = undefined;
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    });
  }
}
