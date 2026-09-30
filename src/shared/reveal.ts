/**
 * Marks elements carrying `data-reveal` once they scroll into view, so their
 * styles can bring them in. Each element is marked once and then left alone.
 */
export function watchReveals(root: ParentNode = document): void {
  const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
        entry.target.dataset['revealed'] = 'true';
        observer.unobserve(entry.target);
      }
    },
    // Wait until a little of the element is above the bottom edge, so its arrival is seen.
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  );
  for (const target of targets) observer.observe(target);
}
