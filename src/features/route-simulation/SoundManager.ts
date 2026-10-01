import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import type { Disposable } from '@/shared/lifecycle';
import { SoundKit, type EngineVoice } from './SoundKit';

const MUTED_KEY = 'sound-muted';
const RAMP = 0.08;

/** Overall loudness of the journey's sounds, shared with film soundtracks. */
export const MASTER_LEVEL = 0.55;

/**
 * Plays the journey's sounds live on a page. Nothing plays until `unlock` is
 * called from a user gesture, which is also what browsers require. The mute
 * choice is remembered.
 */
export class SoundManager implements Disposable {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private kit: SoundKit | undefined;
  private engineVoice: EngineVoice | undefined;
  private mutedState: boolean;

  constructor(private readonly storage: SafeStorage) {
    this.mutedState = storage.read(MUTED_KEY) === '1';
  }

  get muted(): boolean {
    return this.mutedState;
  }

  /** Creates the audio graph. Must run inside a click or key handler. */
  unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioContextClass = globalThis.AudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = this.mutedState ? 0 : MASTER_LEVEL;
    this.master.connect(this.context.destination);
    this.kit = new SoundKit(this.context, this.master);
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.storage.write(MUTED_KEY, muted ? '1' : '0');
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, this.context.currentTime, RAMP);
    }
  }

  /** Low diesel rumble; `level` is 0 when parked, about 0.4 at idle and 1 at speed. */
  setEngine(level: number): void {
    if (!this.context || !this.kit) return;
    this.engineVoice ??= this.kit.engine();
    this.engineVoice.setLevel(level, this.context.currentTime);
  }

  stamp(): void {
    if (this.context) this.kit?.stamp(this.context.currentTime);
  }

  punch(): void {
    if (this.context) this.kit?.punch(this.context.currentTime);
  }

  chime(): void {
    if (this.context) this.kit?.chime(this.context.currentTime);
  }

  dispose(): void {
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.kit = undefined;
    this.engineVoice = undefined;
  }
}
