import {
  ACKNOWLEDGE_REACTION,
  DONE_REACTION,
  FAILED_REACTION,
  type ChannelReactionLevel,
} from "@ngriffin_uk/polychat-schemas";

export type ChannelRunSignal = "picked_up" | "done" | "failed";

export interface ChannelSignalReaction {
  emoji: string;
  remove?: boolean;
}

export function channelSignalReactions(
  level: ChannelReactionLevel,
  signal: ChannelRunSignal,
): ChannelSignalReaction[] {
  if (level === "off") {
    return [];
  }

  if (signal === "picked_up") {
    return [{ emoji: ACKNOWLEDGE_REACTION }];
  }

  const cleared: ChannelSignalReaction = { emoji: ACKNOWLEDGE_REACTION, remove: true };

  if (signal === "failed") {
    return [cleared, { emoji: FAILED_REACTION }];
  }

  return level === "full" ? [cleared, { emoji: DONE_REACTION }] : [cleared];
}
