import { Color, DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three';
import { TURKEY_PROJECTION } from '@/domain/geo/MapProjection';
import type { Disposable, ViewPadding } from '@/shared/lifecycle';
import { yieldToMain } from '@/shared/scheduling';
import { CameraRig } from './CameraRig';
import { LabelLayer } from './LabelLayer';
import { LandmarkFactory } from './LandmarkFactory';
import { LandTexture } from './LandTexture';
import { mapData, ringsExtent } from './MapData';
import { CITIES, SEAS } from './places';
import type { QualityProfile } from './QualityProfile';
import { SceneManager } from './SceneManager';
import { Scenery } from './Scenery';
import { SeaTexture } from './SeaTexture';
import { ToonKit } from './ToonKit';
import { TurkeyBoard } from './TurkeyBoard';
import { KM_PER_UNIT, LAND_TOP, toWorld } from './world';

const SKY = new Color('#dcedf8');
const NO_PADDING: ViewPadding = { left: 0, right: 0, top: 0, bottom: 0 };
const CITY_PRIORITY = { 1: 40, 2: 20 } as const;
const SEA_PRIORITY = 10;
const OVERVIEW_MARGIN = 4;
const ANISOTROPY = 8;
/** Haze range as multiples of the camera's distance to what it is looking at. */
const HAZE_NEAR = 1.7;
const HAZE_FAR = 4.2;

type FrameCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

interface WorldParts {
  readonly manager: SceneManager;
  readonly kit: ToonKit;
  readonly landmarks: LandmarkFactory;
  readonly board: TurkeyBoard;
  readonly scenery: Scenery;
}

/**
 * The illustrated map itself: board, scenery, light, camera and place names.
 * Features such as the route simulation add their own objects on top of it.
 */
export class MapWorld implements Disposable {
  readonly kit: ToonKit;
  readonly rig: CameraRig;
  readonly labels: LabelLayer;
  private readonly manager: SceneManager;
  private readonly landmarks: LandmarkFactory;
  private readonly board: TurkeyBoard;
  private readonly scenery: Scenery;
  private readonly frameCallbacks = new Set<FrameCallback>();
  private padding: ViewPadding = NO_PADDING;
  private viewportKey = '';

  /**
   * Builds the world in stages and yields to the browser between them, so the
   * page stays responsive while textures are painted and geometry is made.
   */
  static async create(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLElement,
    quality: QualityProfile,
    reducedMotion = false,
  ): Promise<MapWorld> {
    const manager = new SceneManager(canvas, quality);
    const kit = new ToonKit();
    await yieldToMain();

    const surroundings = new SeaTexture(mapData, mapData.bounds, quality.texturePixels).canvas;
    await yieldToMain();
    const land = new LandTexture(mapData, quality.texturePixels);
    await yieldToMain();
    const board = new TurkeyBoard(mapData, kit, { surroundings, land, anisotropy: ANISOTROPY });
    await yieldToMain();

    const landmarks = new LandmarkFactory();
    const scenery = new Scenery(landmarks, kit, quality.sceneryDensity);
    await yieldToMain();

    const world = new MapWorld(
      { manager, kit, landmarks, board, scenery },
      labelContainer,
      reducedMotion,
    );
    // Upload the paintings one at a time, then compile shaders off the main thread.
    for (const painting of board.paintings) {
      manager.upload(painting);
      await yieldToMain();
    }
    await manager.compile();
    return world;
  }

  private constructor(parts: WorldParts, labelContainer: HTMLElement, reducedMotion: boolean) {
    this.manager = parts.manager;
    this.kit = parts.kit;
    this.landmarks = parts.landmarks;
    this.board = parts.board;
    this.scenery = parts.scenery;
    this.manager.setBackdrop(SKY);

    const { scene, camera } = this.manager;
    scene.add(new HemisphereLight('#ffffff', '#c4d2dc', 1.5));
    const sun = new DirectionalLight('#fff3dc', 2.1);
    sun.position.set(-70, 130, 90);
    scene.add(sun, this.board.group, this.scenery.group);

    this.rig = new CameraRig(camera, reducedMotion);
    this.labels = new LabelLayer(labelContainer);
    for (const city of CITIES) {
      const position = toWorld(TURKEY_PROJECTION.project(city), LAND_TOP + 0.05);
      this.labels.add(`city:${city.name}`, city.name, position, 'city', CITY_PRIORITY[city.tier]);
    }
    for (const sea of SEAS) {
      const position = toWorld(TURKEY_PROJECTION.project(sea), 0.05);
      this.labels.add(`sea:${sea.name}`, sea.name, position, 'sea', SEA_PRIORITY);
    }

    this.manager.add({
      update: (delta, elapsed) => {
        this.syncViewport();
        for (const callback of this.frameCallbacks) callback(delta, elapsed);
        this.scenery.update(delta, elapsed);
        this.rig.update(delta);
        this.manager.setHaze(this.rig.distance * HAZE_NEAR, this.rig.distance * HAZE_FAR);
        const { width, height } = this.manager.size;
        this.labels.update(camera, width, height);
      },
    });
  }

  get scene(): Scene {
    return this.manager.scene;
  }

  /** Frames the whole country. */
  overviewPose(): { target: Vector3; distance: number; pitch: number } {
    this.syncViewport();
    const { minX, minY, width, height } = ringsExtent(mapData.turkey);
    const pitch = 54;
    return {
      target: new Vector3(
        (minX + width / 2) / KM_PER_UNIT,
        LAND_TOP,
        -(minY + height / 2) / KM_PER_UNIT,
      ),
      distance: this.rig.distanceToFit(
        width / 2 / KM_PER_UNIT + OVERVIEW_MARGIN,
        height / 2 / KM_PER_UNIT + OVERVIEW_MARGIN,
        pitch,
      ),
      pitch,
    };
  }

  setPadding(padding: ViewPadding): void {
    this.padding = padding;
    this.viewportKey = '';
    this.syncViewport();
  }

  onFrame(callback: FrameCallback): void {
    this.frameCallbacks.add(callback);
  }

  start(): void {
    this.manager.start();
  }

  dispose(): void {
    this.manager.dispose();
    this.frameCallbacks.clear();
    this.labels.dispose();
    this.board.dispose();
    this.scenery.dispose();
    this.landmarks.dispose();
    this.kit.dispose();
  }

  /** Re-applies padding whenever the canvas changes size. */
  private syncViewport(): void {
    const { width, height } = this.manager.size;
    const key = `${width}x${height}`;
    if (key === this.viewportKey || width === 0 || height === 0) return;
    this.viewportKey = key;
    this.rig.setViewport(width, height, this.padding);
  }
}
