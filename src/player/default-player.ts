import * as Tone from "tone/Tone";
import { Channel, ChannelConfig, OutputChannel } from "./channel";
import { QueuedPlayer, QueuedPlayerConfig } from "./queued-player";
import { SamplePlayer } from "./sample-player";
import { InternalPlayer, SampleStart, SampleStop } from "./types";

export type DefaultPlayerConfig = ChannelConfig &
  QueuedPlayerConfig;

/**
 * Player used by instruments
 * @private
 */
export class DefaultPlayer implements InternalPlayer {
  public readonly output: OutputChannel;
  private readonly player: InternalPlayer;

  constructor(
    options?: Partial<DefaultPlayerConfig>
  ) {
    const channel = new Channel(options);
    this.player = new QueuedPlayer(
      new SamplePlayer({ ...options, destination: channel.input }),
      options
    );
    this.output = channel;
  }

  get buffers() {
    return this.player.buffers;
  }

  public start(sample: SampleStart) {
    return this.player.start(sample);
  }

  public stop(sample?: SampleStop | string | number) {
    this.player.stop(
      typeof sample === "object"
        ? sample
        : sample !== undefined
        ? { stopId: sample }
        : undefined
    );
  }

  disconnect() {
    this.output.disconnect();
    this.player.disconnect();
  }
}
