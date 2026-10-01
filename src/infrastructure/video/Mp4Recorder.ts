import type {
  FilmRecorder,
  FilmRecorderFactory,
  RecorderSettings,
  RecorderSupport,
} from '@/features/film/FilmRecorder';

const SOUND_BITRATE = 160_000;
/** A key frame every second keeps scrubbing smooth in players and editors. */
const KEY_FRAME_SECONDS = 1;

/**
 * Records MP4 files with H.264 picture and AAC sound, the pairing Instagram
 * and phones play without converting. Encoding is done by the browser's own
 * WebCodecs encoders, on the graphics chip where there is one; the mediabunny
 * library writes the file. It is loaded only when a film is actually made.
 */
export const mp4Recorders: FilmRecorderFactory = {
  extension: 'mp4',

  async support(size, settings): Promise<RecorderSupport> {
    if (typeof VideoEncoder === 'undefined') return { video: false, sound: false };
    const { canEncodeVideo, canEncodeAudio } = await import('mediabunny');
    const [video, sound] = await Promise.all([
      canEncodeVideo('avc', { ...size, bitrate: settings.bitrate, frameRate: settings.frameRate }),
      typeof AudioEncoder === 'undefined'
        ? false
        : canEncodeAudio('aac', {
            numberOfChannels: 2,
            sampleRate: 48_000,
            bitrate: SOUND_BITRATE,
          }),
    ]);
    return { video, sound };
  },

  async open(canvas: HTMLCanvasElement, settings: RecorderSettings): Promise<FilmRecorder> {
    const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output } =
      await import('mediabunny');
    const target = new BufferTarget();
    const output = new Output({
      // The index goes to the front of the file, so it starts playing before it has fully loaded.
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    const picture = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate: settings.bitrate,
      keyFrameInterval: KEY_FRAME_SECONDS,
      latencyMode: 'quality',
    });
    output.addVideoTrack(picture, { frameRate: settings.frameRate });
    const sound = settings.sound
      ? new AudioBufferSource({ codec: 'aac', bitrate: SOUND_BITRATE })
      : undefined;
    if (sound) output.addAudioTrack(sound);
    await output.start();

    return {
      addSound: async (buffer) => {
        await sound?.add(buffer);
      },
      addFrame: (time, duration) => picture.add(time, duration),
      finish: async () => {
        await output.finalize();
        if (!target.buffer) throw new Error('The recorder produced no file');
        return new Blob([target.buffer], { type: 'video/mp4' });
      },
      cancel: () => output.cancel(),
    };
  },
};
