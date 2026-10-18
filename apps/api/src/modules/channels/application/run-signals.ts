import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ChannelReactionLevel } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import {
  channelSignalReactions,
  type ChannelRunSignal,
} from "~/modules/channels/domain/reaction-signals";
import type { IEnv } from "~/types";

import type { ChannelAdapter, ChannelMessageRef } from "./ports/channel-adapter";

const logger = getLogger({ prefix: "services/channels/run-signals" });

export async function signalChannelRun(params: {
  adapter: ChannelAdapter;
  env: IEnv;
  level: ChannelReactionLevel;
  target: ChannelMessageRef;
  signal: ChannelRunSignal;
}): Promise<void> {
  const { adapter, env, level, target, signal } = params;

  try {
    for (const reaction of channelSignalReactions(level, signal)) {
      await adapter.react?.(target, reaction, env);
    }

    if (signal === "picked_up" && level !== "off") {
      await adapter.showWorking?.(target, env);
    }
  } catch (error) {
    logger.warn("Could not show a channel signal", {
      channel: adapter.id,
      signal,
      error: getErrorMessage(error, "Unknown error"),
    });
  }
}

export async function runChannelTurn<T>(
  delivery: { signal?(signal: ChannelRunSignal): Promise<void> },
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    await delivery.signal?.("failed");

    throw error;
  }
}
