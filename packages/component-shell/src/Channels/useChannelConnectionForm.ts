import type { CreateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useChannelConnectionForm(
  onCreate: (input: CreateChannelBindingInput) => Promise<unknown>,
  projectId?: string,
) {
  const [channel, setChannel] = useState<"slack" | "telegram" | "email">("slack");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [teammateId, setTeammateId] = useState("");
  const [automated, setAutomated] = useState(true);
  const submit = async () => {
    await onCreate({
      channel,
      externalId,
      projectId,
      label: label.trim() || undefined,
      teammateId: teammateId || undefined,
      interactionMode: automated ? "automated" : "direct",
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
    automated,
    setAutomated,
    submit,
  };
}
