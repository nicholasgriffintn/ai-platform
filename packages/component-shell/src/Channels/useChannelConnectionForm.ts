import type { CreateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useChannelConnectionForm(
  onCreate: (input: CreateChannelBindingInput) => Promise<unknown>,
  projectId?: string,
) {
  const [channel, setChannel] = useState<"slack" | "telegram">("slack");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [teammateId, setTeammateId] = useState("");
  const [automated, setAutomated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
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
    } catch (failure) {
      setError(getErrorMessage(failure, "Channel could not be connected"));
    } finally {
      setBusy(false);
    }
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
    busy,
    error,
    submit,
  };
}
