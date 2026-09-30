/** Which map a page should draw: the device decides unless the address asks for one. */
export type MapChoice = 'auto' | '3d' | 'flat';

export interface GraphicsRequest {
  readonly antialias: boolean;
  /** Accept a renderer that draws on the processor. It is slow, so only on request. */
  readonly allowSoftware: boolean;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const MASKED_RENDERER = /webkit webgl/i;

/**
 * `?harita=duz` in the address forces the flat map and `?harita=3b` the 3D one.
 * The switch exists for testing and support; visitors never need it.
 */
export function mapChoice(search: string): MapChoice {
  const wish = new URLSearchParams(search).get('harita');
  if (wish === 'duz') return 'flat';
  return wish === '3b' ? '3d' : 'auto';
}

/** Whether a renderer name belongs to one that draws on the processor instead of a graphics chip. */
export function isSoftwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}

function rendererName(context: WebGL2RenderingContext): string {
  const plain = String(context.getParameter(context.RENDERER));
  // Chromium and Safari answer with a generic name unless asked through the extension.
  const info = MASKED_RENDERER.test(plain)
    ? context.getExtension('WEBGL_debug_renderer_info')
    : null;
  return info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : plain;
}

/**
 * Opens the WebGL 2 context the 3D map draws with. Returns null when the
 * browser has no WebGL 2, or when it would draw on the processor instead of a
 * graphics chip: that is too slow for smooth motion, and the flat map serves
 * such a device better.
 */
export function openGraphics(
  canvas: HTMLCanvasElement,
  request: GraphicsRequest,
): WebGL2RenderingContext | null {
  try {
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: request.antialias,
      stencil: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: !request.allowSoftware,
    });
    if (!context) return null;
    if (request.allowSoftware || !isSoftwareRenderer(rendererName(context))) return context;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  } catch {
    return null;
  }
}
