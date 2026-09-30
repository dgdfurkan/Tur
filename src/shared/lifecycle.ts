export interface Disposable {
  dispose(): void;
}

/** Anything that changes over time and is ticked once per rendered frame. */
export interface Updatable {
  update(deltaSeconds: number, elapsedSeconds: number): void;
}

/** Pixels of a viewport covered by interface panels; content is framed in what remains. */
export interface ViewPadding {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
