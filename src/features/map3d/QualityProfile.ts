/** Rendering budget for a class of device. */
export interface QualityProfile {
  readonly name: 'high' | 'medium' | 'low';
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  /** Share of decorative scenery (trees, hills) to place, 0 to 1. */
  readonly sceneryDensity: number;
  /** Width in pixels of the painted map textures. */
  readonly texturePixels: number;
}

const PROFILES = {
  high: { name: 'high', pixelRatioCap: 2, antialias: true, sceneryDensity: 1, texturePixels: 2048 },
  medium: {
    name: 'medium',
    pixelRatioCap: 1.5,
    antialias: true,
    sceneryDensity: 0.6,
    texturePixels: 1536,
  },
  low: {
    name: 'low',
    pixelRatioCap: 1,
    antialias: false,
    sceneryDensity: 0.3,
    texturePixels: 1024,
  },
} as const satisfies Record<string, QualityProfile>;

/**
 * For film frames, which are not drawn in real time: everything at its best,
 * and paintings large enough to stay sharp on a 4K frame. A film's own frame
 * sets the pixel ratio, so the cap here is never reached.
 */
export const STUDIO_QUALITY: QualityProfile = {
  name: 'high',
  pixelRatioCap: Number.POSITIVE_INFINITY,
  antialias: true,
  sceneryDensity: 1,
  texturePixels: 4096,
};

interface DeviceHints {
  readonly coarsePointer: boolean;
  readonly cores: number;
  /** Gigabytes; only Chromium reports it. */
  readonly memory: number | undefined;
  readonly saveData: boolean;
}

/** Picks a starting profile from capability hints; the scene lowers it further if frames run long. */
export function selectQuality(hints: DeviceHints): QualityProfile {
  if (hints.saveData) return PROFILES.low;
  const constrained = hints.cores <= 4 || (hints.memory !== undefined && hints.memory <= 4);
  if (hints.coarsePointer) return constrained ? PROFILES.low : PROFILES.medium;
  return constrained ? PROFILES.medium : PROFILES.high;
}

export function lowerQuality(profile: QualityProfile): QualityProfile {
  return profile.name === 'high' ? PROFILES.medium : PROFILES.low;
}

interface NavigatorHints {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly connection?: { readonly saveData?: boolean };
}

export function detectQuality(): QualityProfile {
  const nav: NavigatorHints = navigator;
  return selectQuality({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
  });
}
