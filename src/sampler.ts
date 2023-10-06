import * as Tone from "tone/Tone";
import { DefaultPlayer } from "./player/default-player";
import {
  AudioBuffersLoader,
  loadAudioBuffer,
} from "./player/load-audio";
import { SampleStart, SampleStop } from "./player/types";
import { midiVelToGain } from "./player/volume";
import { HttpStorage, Storage } from "./storage";

export type SamplerConfig = {
  storage?: Storage;
  detune: number;
  volume: number;
  velocity: number;
  decayTime?: number;
  lpfCutoffHz?: number;
  destination: Tone.ToneAudioNode;

  buffers: Tone.ToneAudioBuffers | AudioBuffersLoader;
  volumeToGain: (volume: number) => number;
};

/**
 * A Sampler instrument
 *
 * @private
 */
export class Sampler {
  #options: SamplerConfig;
  private readonly player: DefaultPlayer;
  public readonly load: Promise<this>;

  public constructor(
    options: Partial<SamplerConfig> = {}
  ) {
    this.#options = {
      destination: options.destination ?? Tone.Destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      buffers: options.buffers ?? new Tone.ToneAudioBuffers(),
      volumeToGain: options.volumeToGain ?? midiVelToGain,
    };
    this.player = new DefaultPlayer(this.#options);
    const storage = options.storage ?? HttpStorage;
    const loader =
      typeof this.#options.buffers === "function"
        ? this.#options.buffers
        : createAudioBuffersLoader(this.#options.buffers, storage);
    this.load = loader(this.player.buffers).then(() => this);
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  get output() {
    return this.player.output;
  }

  start(sample: SampleStart | string | number) {
    return this.player.start(
      typeof sample === "object" ? sample : { note: sample }
    );
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(
      typeof sample === "object"
        ? sample
        : sample === undefined
        ? undefined
        : { stopId: sample }
    );
  }

  disconnect() {
    return this.player.disconnect();
  }
}

function createAudioBuffersLoader(
  source: Tone.ToneAudioBuffers,
  storage: Storage
): AudioBuffersLoader {
  return async (buffers) => {
    await Promise.all([
      Object.keys(source).map(async (key) => {
        const value = source.get(key);
        if (value instanceof Tone.ToneAudioBuffer) {
          buffers.get(key).set(value);
        } else if (typeof value === "string") {
          const buffer = await loadAudioBuffer(value, storage);
          if (buffer) buffers.get(key).set(buffer);
        }
      }),
    ]);
  };
}
