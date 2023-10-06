import * as Tone from "tone/Tone";
import { connectSerial } from "./connect";
import { Trigger, createTrigger, unsubscribeAll } from "./signals";
import {
  InternalPlayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./types";
import { midiVelToGain } from "./volume";

export type SamplePlayerConfig = {
  velocityToGain: (velocity: number) => number;
  destination: Tone.ToneAudioNode;
} & SampleOptions;

/**
 * A sample player. This is used internally by the Sampler.
 *
 * @private Not intended for public use
 */
export class SamplePlayer implements InternalPlayer {
  public readonly buffers!: Tone.ToneAudioBuffers;
  #config: SamplePlayerConfig;
  #disconnected = false;
  #stop: Trigger<SampleStop | undefined>;

  public constructor(
    private readonly options: Partial<SamplePlayerConfig>
  ) {
    this.#config = {
      velocityToGain: options.velocityToGain ?? midiVelToGain,
      destination: options.destination ?? Tone.Destination,
    };
    this.buffers = new Tone.ToneAudioBuffers();
    this.#stop = createTrigger();
  }

  public start(sample: SampleStart) {
    if (this.#disconnected) {
      throw new Error("Can't start a sample on disconnected player");
    }
    const buffer =
      (sample.name && this.buffers.get(sample.name)) || this.buffers.get(sample.note);
    if (!buffer) {
      console.warn(`Sample not found: '${sample.note}'`);
      return () => undefined;
    }

    const source = new Tone.BufferSource(buffer);
    // source.detune.value = sample.detune ?? this.options.detune ?? 0;

    // Low pass filter
    const lpfCutoffHz = sample.lpfCutoffHz ?? this.options.lpfCutoffHz;
    const lpf = lpfCutoffHz
      ? new Tone.BiquadFilter( {
          type: "lowpass",
          frequency: sample.lpfCutoffHz,
        })
      : undefined;

    // Sample volume
    const volume = new Tone.Volume();
    const velocity = sample.velocity ?? this.options.velocity ?? 100;
    volume.volume.linearRampTo(Tone.gainToDb(velocity), 0.001, sample.time);

    const loop = sample.loop ?? this.options.loop;
    if (loop) {
      source.loop = true;
      source.loopStart = sample.loopStart ?? 0;
      source.loopEnd = sample.loopEnd ?? buffer.duration;
    }

    // Stop with decay
    const decayTime = sample.decayTime ?? this.options.decayTime;
    const [decay, startDecay] = createDecayEnvelope(decayTime);
    function stop(time?: number) {
      time ??= Tone.now();
      if (time <= startAt) {
        source.stop(time);
      } else {
        const stopAt = startDecay(time);
        source.stop(stopAt);
      }
    }

    // Compensate gain
    const gainCompensation = sample.gainOffset
      ? new Tone.Gain( { gain: sample.gainOffset })
      : undefined;

    const stopId = sample.stopId ?? sample.note;
    const cleanup = unsubscribeAll([
      connectSerial([
        source,
        lpf,
        volume,
        decay,
        gainCompensation,
        this.#config.destination,
      ]),
      sample.stop?.(stop),
      this.#stop.subscribe((event) => {
        if (!event || event.stopId === undefined || event.stopId === stopId) {
          stop(event?.time);
        }
      }),
    ]);
    source.onended = () => {
      cleanup();
      sample.onEnded?.(sample);
    };

    sample.onStart?.(sample);
    const startAt = Math.max(sample.time ?? 0, Tone.now());
    source.start(sample.time);

    const duration = sample.duration ?? buffer.duration;
    if (typeof sample.duration == "number") {
      stop(startAt + duration);
    }

    return stop;
  }

  stop(sample?: SampleStop) {
    this.#stop.trigger(sample);
  }

  public disconnect() {
    if (this.#disconnected) return;
    this.#disconnected = true;
    this.stop();
    this.buffers.dispose();
  }

  public get connected() {
    return !this.#disconnected;
  }
}

function createDecayEnvelope(
  envelopeTime = 0.2
): [Tone.ToneAudioNode, (time: number) => number] {
  let stopAt = 0;
  const envelope = new Tone.Gain({ gain: 1.0 });

  function start(time: number): number {
    if (stopAt) return stopAt;
    envelope.gain.cancelScheduledValues(time);
    const envelopeAt = time || Tone.now();
    stopAt = envelopeAt + envelopeTime;
    envelope.gain.setValueAtTime(1.0, envelopeAt);
    envelope.gain.linearRampToValueAtTime(0, stopAt);

    return stopAt;
  }

  return [envelope, start];
}
