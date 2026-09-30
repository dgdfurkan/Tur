/**
 * Whether this page is shown inside another page's frame. The static host
 * cannot send a frame-ancestors header, so a page that acts on stored data
 * checks for itself and refuses to run when it is framed.
 */
export function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    // Reading the top window can throw across origins; that only happens in a frame.
    return true;
  }
}
