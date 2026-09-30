import { Color, DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three';
import { TURKEY_PROJECTION } from '@/domain/geo/MapProjection';
import type { Disposable, ViewPadding } from '@/shared/lifecycle';
import { CameraRig } from './CameraRig';
import { LabelLayer } from './LabelLayer';
import { LandmarkFactory } from './LandmarkFactory';
import { mapData } from './MapData';
import { CITIES, SEAS } from './places';
import type { QualityProfile } from './QualityProfile';
import { SceneManager } from './SceneManager';
import { Scenery } from './Scenery';
import { ToonKit } from './ToonKit';
import { TurkeyBoard } from './TurkeyBoard';
import { LAND_TOP, toWorld } from './world';

const SKY = new Color('#dcedf8');
const NO_PADDING: ViewPadding = { left: 0, right: 0, top: 0, bottom: 0 };
const CITY_PRIORITY = { 1: 40, 2: 20 } as const;
const SEA_PRIORITY = 10;

type FrameCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

/**
 * The illustrated map itself: board, scenery, light, camera and place names.
 * Features such as the route simulation add their own objects on top of it.
 */
export class MapWorld implements Disposable {
  readonly kit = new ToonKit();
  readonly rig: CameraRig;
  readonly labels: LabelLayer;
  private readonly manager: SceneManager;
  private readonly landmarks = new LandmarkFactory();
  private readonly board: TurkeyBoard;
  private readonly scenery: Scenery;
  private readonly frameCallbacks = new Set<FrameCallback>();
  private padding: ViewPadding = NO_PADDING;
  private viewportKey = '';

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLElement,
    quality: QualityProfile,
    reducedMotion = false,
  ) {
    this.manager = new SceneManager(canvas, quality);
    this.manager.setBackdrop(SKY, 260, 600);

    const { scene, camera } = this.manager;
    scene.add(new HemisphereLight('#ffffff', '#c4d2dc', 1.5));
    const sun = new DirectionalLight('#fff3dc', 2.1);
    sun.position.set(-70, 130, 90);
    scene.add(sun);

    this.board = new TurkeyBoard(mapData, this.kit, {
      texturePixels: quality.name === 'low' ? 1024 : 2048,
      anisotropy: 8,
    });
    scene.add(this.board.group);

    this.scenery = new Scenery(this.landmarks, this.kit, quality.sceneryDensity);
    scene.add(this.scenery.group);

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
    const { bounds } = mapData;
    const pitch = 54;
    // Bounds include neighbouring land; Turkey itself spans about half of that frame.
    return {
      target: new Vector3(1, LAND_TOP, -1),
      distance: this.rig.distanceToFit(
        ((bounds.maxX - bounds.minX) / 20) * 0.36,
        ((bounds.maxY - bounds.minY) / 20) * 0.26,
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
