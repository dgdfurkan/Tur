import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import type { Disposable } from '@/shared/lifecycle';

const MUTED_KEY = 'sound-muted';
const MASTER_LEVEL = 0.55;
const RAMP = 0.08;

/**
 * All sound is synthesised with the Web Audio API, so the site ships no audio
 * files. Nothing plays until `unlock` is called from a user gesture, which is
 * also what browsers require.
 */
export class SoundManager implements Disposable {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private engineGain: GainNode | undefined;
  private engineTone: OscillatorNode | undefined;
  private engineFilter: BiquadFilterNode | undefined;
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
    if (!this.context || !this.master) return;
    if (!this.engineGain) this.startEngine(this.context, this.master);
    const now = this.context.currentTime;
    this.engineGain?.gain.setTargetAtTime(0.5 * level, now, 0.35);
    this.engineTone?.frequency.setTargetAtTime(44 + 22 * level, now, 0.5);
    this.engineFilter?.frequency.setTargetAtTime(120 + 160 * level, now, 0.5);
  }

  /** The thud of a rubber stamp. */
  stamp(): void {
    this.thump(95, 0.16, 0.9);
    this.noiseBurst(0.07, 900, 0.5);
  }

  /** The click of a ticket punch. */
  punch(): void {
    this.noiseBurst(0.03, 3200, 0.35);
    this.thump(220, 0.05, 0.3);
  }

  /** Two soft notes, like a coach's announcement chime. */
  chime(): void {
    this.note(784, 0, 0.5);
    this.note(659, 0.16, 0.7);
  }

  dispose(): void {
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.engineGain = undefined;
    this.engineTone = undefined;
    this.engineFilter = undefined;
  }

  private startEngine(context: AudioContext, master: GainNode): void {
    this.engineGain = context.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 120;
    this.engineFilter.connect(this.engineGain).connect(master);

    this.engineTone = context.createOscillator();
    this.engineTone.type = 'sawtooth';
    this.engineTone.frequency.value = 44;
    const toneGain = context.createGain();
    toneGain.gain.value = 0.5;
    this.engineTone.connect(toneGain).connect(this.engineFilter);
    this.engineTone.start();

    // Brown noise gives the rumble its body; two seconds loop without an audible seam.
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < samples.length; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      samples[i] = last * 3.5;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(this.engineFilter);
    noise.start();
  }

  private thump(frequency: number, seconds: number, level: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency / 2, now + seconds);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + seconds);
  }

  private noiseBurst(seconds: number, cutoff: number, level: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const length = Math.ceil(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    gain.gain.value = level;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  private note(frequency: number, delay: number, seconds: number): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  }
}
