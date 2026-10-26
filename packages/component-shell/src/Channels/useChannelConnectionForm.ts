import type {
  ChannelInteractionMode,
  ChannelReactionLevel,
  CreateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useChannelConnectionForm(
  onCreate: (input: CreateChannelBindingInput) => Promise<unknown>,
  projectId?: string,
) {
  const [channel, setChannel] = useState<"slack" | "telegram" | "email">("slack");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [teammateId, setTeammateId] = useState("");
  const [interactionMode, setInteractionMode] = useState<ChannelInteractionMode>("automated");
  const [reactionLevel, setReactionLevel] = useState<ChannelReactionLevel>("ack");
  const submit = async () => {
    await onCreate({
      channel,
      externalId,
      projectId,
      label: label.trim() || undefined,
      teammateId: teammateId || undefined,
      interactionMode,
      reactionLevel,
    });
    setExternalId("");
    setLabel("");
  };

  return {
    channel,
    setChannel,
    externalId,
    setExternalId,
    label,
    setLabel,
    teammateId,
    setTeammateId,
    interactionMode,
    setInteractionMode,
    reactionLevel,
    setReactionLevel,
    submit,
  };
}
