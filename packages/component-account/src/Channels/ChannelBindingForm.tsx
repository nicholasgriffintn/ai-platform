import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  createChannelBindingSchema,
  type CreateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState, type FormEvent } from "react";

import { ChannelSettingsFields } from "./ChannelSettingsFields";

export interface ChannelBindingFormProps {
  projectId?: string;
  teammates: { id: string; name: string }[];
  isSaving: boolean;
  errorMessage?: string;
  onSave: (input: CreateChannelBindingInput) => Promise<void>;
}

export function ChannelBindingForm({
  projectId,
  teammates,
  isSaving,
  errorMessage,
  onSave,
}: ChannelBindingFormProps) {
  const [channel, setChannel] = useState<"slack" | "telegram">("slack");
  const [externalId, setExternalId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [label, setLabel] = useState("");
  const [senderIds, setSenderIds] = useState("");
  const [replyMode, setReplyMode] = useState<"mentions" | "all">("mentions");
  const [interactionMode, setInteractionMode] = useState<"direct" | "automated">("direct");
  const [teammateId, setTeammateId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = createChannelBindingSchema.safeParse({
      channel,
      externalId,
      workspaceId: channel === "slack" ? workspaceId : undefined,
      allowedSenderIds: splitNonEmptyLines(senderIds),
      replyMode,
      interactionMode,
      projectId,
      teammateId: teammateId || undefined,
      label: label || undefined,
    });

    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Check the channel settings");

      return;
    }

    setValidationError(null);
    try {
      await onSave(parsed.data);
      setExternalId("");
      setLabel("");
      setSenderIds("");
    } catch {
      return;
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <FormSelect
        label="Service"
        value={channel}
        onValueChange={setChannel}
        disabled={isSaving}
        options={
          projectId
            ? [{ value: "slack", label: "Slack" }]
            : [
                { value: "slack", label: "Slack" },
                { value: "telegram", label: "Telegram" },
              ]
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label={channel === "slack" ? "Channel ID" : "Chat ID"}
          value={externalId}
          onChange={(event) => setExternalId(event.target.value)}
          disabled={isSaving}
          required
        />
        {channel === "slack" ? (
          <FormInput
            label="Slack workspace ID"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            description="Use the workspace where the Polychat bot is installed."
            disabled={isSaving}
            required
          />
        ) : null}
      </div>
      <FormInput
        label="Name"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="For example, Support requests"
        disabled={isSaving}
      />
      <ChannelSettingsFields
        senderIds={senderIds}
        replyMode={replyMode}
        disabled={isSaving}
        onSenderIdsChange={setSenderIds}
        onReplyModeChange={setReplyMode}
      />
      <FormSelect
        label="Reply handling"
        value={interactionMode}
        onValueChange={setInteractionMode}
        disabled={isSaving}
        options={[
          { value: "direct", label: "Reply to each eligible message" },
          { value: "automated", label: "Judge whether a reply is needed" },
        ]}
      />
      <FormSelect
        label="Teammate"
        value={teammateId}
        onValueChange={setTeammateId}
        disabled={isSaving}
        options={[
          { value: "", label: "Default assistant" },
          ...teammates.map((teammate) => ({ value: teammate.id, label: teammate.name })),
        ]}
      />
      {validationError || errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {validationError ?? errorMessage}
        </p>
      ) : null}
      <Button type="submit" variant="primary" isLoading={isSaving}>
        Connect channel
      </Button>
    </form>
  );
}
