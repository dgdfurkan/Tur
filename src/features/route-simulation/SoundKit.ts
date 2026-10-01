const ENGINE_NOISE_SECONDS = 2;

/** The coach's engine: a level from 0 (off) through about 0.4 (idling) to 1 (at speed). */
export interface EngineVoice {
  setLevel(level: number, at: number): void;
}

/**
 * Synthesises every sound of the journey with the Web Audio API, so no audio
 * files are shipped. Each sound is scheduled at an explicit time on whatever
 * context it is given: the live one on a page, or an offline one that renders
 * a film's soundtrack.
 */
export class SoundKit {
  constructor(
    private readonly context: BaseAudioContext,
    private readonly output: AudioNode,
  ) {}

  /** The thud of a rubber stamp. */
  stamp(at: number): void {
    this.thump(at, 95, 0.16, 0.9);
    this.noiseBurst(at, 0.07, 900, 0.5);
  }

  /** The click of a ticket punch. */
  punch(at: number): void {
    this.noiseBurst(at, 0.03, 3200, 0.35);
    this.thump(at, 220, 0.05, 0.3);
  }

  /** Two soft notes, like a coach's announcement chime. */
  chime(at: number): void {
    this.note(at, 784, 0.5);
    this.note(at + 0.16, 659, 0.7);
  }

  /** Starts a low diesel rumble, silent until its level is raised. */
  engine(): EngineVoice {
    const { context } = this;
    const gain = context.createGain();
    gain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.connect(gain).connect(this.output);

    const tone = context.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.value = 44;
    const toneGain = context.createGain();
    toneGain.gain.value = 0.5;
    tone.connect(toneGain).connect(filter);
    tone.start();

    // Brown noise gives the rumble its body; two seconds loop without an audible seam.
    const length = Math.ceil(context.sampleRate * ENGINE_NOISE_SECONDS);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      samples[i] = last * 3.5;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter);
    noise.start();

    return {
      setLevel: (level, at) => {
        gain.gain.setTargetAtTime(0.5 * level, at, 0.35);
        tone.frequency.setTargetAtTime(44 + 22 * level, at, 0.5);
        filter.frequency.setTargetAtTime(120 + 160 * level, at, 0.5);
      },
    };
  }

  private thump(at: number, frequency: number, seconds: number, level: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency / 2, at + seconds);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    oscillator.connect(gain).connect(this.output);
    oscillator.start(at);
    oscillator.stop(at + seconds);
  }

  private noiseBurst(at: number, seconds: number, cutoff: number, level: number): void {
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
    source.connect(filter).connect(gain).connect(this.output);
    source.start(at);
  }

  private note(at: number, frequency: number, seconds: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.28, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    oscillator.connect(gain).connect(this.output);
    oscillator.start(at);
    oscillator.stop(at + seconds);
  }
}
