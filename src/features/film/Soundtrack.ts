import { SoundKit, type EngineVoice } from '@/features/route-simulation/SoundKit';
import { MASTER_LEVEL } from '@/features/route-simulation/SoundManager';
import type { SoundCue } from './FilmOverlay';

const SAMPLE_RATE = 48_000;
const FADE_OUT_SECONDS = 0.5;

/**
 * Renders a film's soundtrack from its cues, faster than real time. The sounds
 * are the ones the live simulation plays: the engine, the stamp, the chime.
 */
export async function renderSoundtrack(
  cues: readonly SoundCue[],
  seconds: number,
): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.setValueAtTime(MASTER_LEVEL, 0);
  master.gain.setValueAtTime(MASTER_LEVEL, Math.max(0, seconds - FADE_OUT_SECONDS));
  master.gain.linearRampToValueAtTime(0, seconds);
  master.connect(context.destination);

  const kit = new SoundKit(context, master);
  let engine: EngineVoice | undefined;
  for (const cue of cues) {
    switch (cue.kind) {
      case 'engine':
        engine ??= kit.engine();
        engine.setLevel(cue.level, cue.time);
        break;
      case 'stamp':
        kit.stamp(cue.time);
        break;
      case 'punch':
        kit.punch(cue.time);
        break;
      case 'chime':
        kit.chime(cue.time);
        break;
    }
  }
  return context.startRendering();
}
