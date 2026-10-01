export interface RecorderSettings {
  readonly frameRate: number;
  /** Bits per second for the picture. */
  readonly bitrate: number;
  /** Whether the film has a soundtrack. */
  readonly sound: boolean;
}

/** Turns the frames of a canvas, and a soundtrack, into a video file. */
export interface FilmRecorder {
  /** Adds the whole soundtrack. */
  addSound(buffer: AudioBuffer): Promise<void>;
  /**
   * Captures the canvas as it is now as the frame shown at `time`. Resolves
   * when the recorder is ready for the next frame.
   */
  addFrame(time: number, duration: number): Promise<void>;
  /** Closes the file and hands it over. */
  finish(): Promise<Blob>;
  /** Abandons the file. */
  cancel(): Promise<void>;
}

export interface RecorderSupport {
  readonly video: boolean;
  readonly sound: boolean;
}

/** Whatever makes recorders; the film only knows this much about video encoding. */
export interface FilmRecorderFactory {
  /** File name extension of what the recorders produce, without the dot. */
  readonly extension: string;
  /** What this browser can encode for frames of the given pixel size. */
  support(
    size: { width: number; height: number },
    settings: RecorderSettings,
  ): Promise<RecorderSupport>;
  open(canvas: HTMLCanvasElement, settings: RecorderSettings): Promise<FilmRecorder>;
}
