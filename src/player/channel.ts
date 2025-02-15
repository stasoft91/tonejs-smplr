import * as Tone from "tone/Tone";
import { AudioInsert, connectSerial } from "./connect";
import { createControl } from "./signals";
import { midiVelToGain } from "./volume";

export type ChannelConfig = {
  destination: Tone.ToneAudioNode;
  volume: number;
  volumeToGain: (volume: number) => number;
};

export type OutputChannel = Omit<Channel, "input">;

type Send = {
  name: string;
  mix: Tone.Gain;
  disconnect: () => void;
};

/**
 * An output channel with audio effects
 * @private
 */
export class Channel {
  public readonly setVolume: (vol: number) => void;
  public readonly input: Tone.ToneAudioNode;

  #volume: Tone.Gain;
  #sends?: Send[];
  #inserts?: (Tone.ToneAudioNode | AudioInsert)[];
  #disconnect: () => void;
  #unsubscribe: () => void;
  #config: Readonly<ChannelConfig>;
  #disconnected = false;

  constructor(
    options?: Partial<ChannelConfig>
  ) {
    this.#config = {
      destination: options?.destination ?? Tone.Destination,
      volume: options?.volume ?? 100,
      volumeToGain: options?.volumeToGain ?? midiVelToGain,
    };

    this.input = new Tone.Gain();
    this.#volume = new Tone.Gain();

    this.#disconnect = connectSerial([
      this.input,
      this.#volume,
      this.#config.destination,
    ]);

    const volume = createControl(this.#config.volume);
    this.setVolume = volume.set;
    this.#unsubscribe = volume.subscribe((volume) => {
      this.#volume.gain.value = this.#config.volumeToGain(volume);
    });
  }

  addInsert(effect: Tone.ToneAudioNode | AudioInsert) {
    if (this.#disconnected) {
      throw Error("Can't add insert to disconnected channel");
    }
    this.#inserts ??= [];
    this.#inserts.push(effect);
    this.#disconnect();
    this.#disconnect = connectSerial([
      this.input,
      ...this.#inserts,
      this.#volume,
      this.#config.destination,
    ]);
  }

  addEffect(
    name: string,
    effect: Tone.ToneAudioNode | { input: Tone.ToneAudioNode },
    mixValue: number
  ) {
    if (this.#disconnected) {
      throw Error("Can't add effect to disconnected channel");
    }
    const mix = new Tone.Gain();
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([this.#volume, mix, input]);

    this.#sends ??= [];
    this.#sends.push({ name, mix, disconnect });
  }

  sendEffect(name: string, mix: number) {
    if (this.#disconnected) {
      throw Error("Can't send effect to disconnected channel");
    }

    const send = this.#sends?.find((send) => send.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }

  disconnect() {
    if (this.#disconnected) return;
    this.#disconnected = true;
    this.#disconnect();
    this.#unsubscribe();
    this.#sends?.forEach((send) => send.disconnect());
    this.#sends = undefined;
  }
}
