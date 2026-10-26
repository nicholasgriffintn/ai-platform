import { FormDialog, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type {
  ChannelInteractionMode,
  CreateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";

import { useChannelConnectionForm } from "./useChannelConnectionForm.js";

const EXTERNAL_ID_FIELDS = {
  slack: {
    label: "Workspace and channel IDs",
    description: "Enter the Slack workspace ID and channel ID, separated by a colon.",
    placeholder: "T012345:C012345",
  },
  telegram: {
    label: "Private chat ID",
    description: "Enter the ID of your private conversation with the Telegram bot.",
    placeholder: "123456789",
  },
  email: {
    label: "Your email address",
    description: "Enter the address you will write from. Its mail provider must sign with DKIM.",
    placeholder: "you@example.com",
  },
} as const;

export function ChannelConnectionForm({
  projectId,
  teammates,
  onCreate,
  onClose,
  isPending,
  error,
}: {
  projectId?: string;
  teammates: { id: string; name: string }[];
  onCreate: (input: CreateChannelBindingInput) => Promise<unknown>;
  onClose: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  const form = useChannelConnectionForm(onCreate, projectId);

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
      title="Connect channel"
      description={
        projectId
          ? "Bring a Slack channel into this project. Each person links their own account to join in."
          : "Continue your conversations in Slack, Telegram or email. Personal channels support direct messages only."
      }
      submitText="Connect channel"
      isLoading={isPending}
      onSubmit={async () => {
        if (isPending) {
          return;
        }

        await form.submit();
        onClose();
      }}
    >
      <FormSelect<"slack" | "telegram" | "email">
        label="Service"
        value={form.channel}
        disabled={isPending}
        onValueChange={form.setChannel}
        options={
          projectId
            ? [{ value: "slack", label: "Slack" }]
            : [
                { value: "slack", label: "Slack" },
                { value: "telegram", label: "Telegram" },
                { value: "email", label: "Email" },
              ]
        }
      />
      <FormInput
        label={EXTERNAL_ID_FIELDS[form.channel].label}
        description={EXTERNAL_ID_FIELDS[form.channel].description}
        required
        maxLength={200}
        type={form.channel === "email" ? "email" : "text"}
        placeholder={EXTERNAL_ID_FIELDS[form.channel].placeholder}
        value={form.externalId}
        disabled={isPending}
        onChange={(event) => form.setExternalId(event.target.value)}
      />
      <FormInput
        label="Name (optional)"
        maxLength={120}
        placeholder={projectId ? "e.g. Launch planning" : "e.g. My Slack messages"}
        value={form.label}
        disabled={isPending}
        onChange={(event) => form.setLabel(event.target.value)}
      />
      <FormSelect
        label="Reply as"
        value={form.teammateId}
        disabled={isPending}
        onValueChange={form.setTeammateId}
        options={[
          { value: "", label: "Polychat assistant" },
          ...teammates.map((teammate) => ({ value: teammate.id, label: teammate.name })),
        ]}
      />
      {form.channel === "email" ? null : (
        <FormSelect<"off" | "ack" | "full">
          label="Reactions"
          value={form.reactionLevel}
          disabled={isPending}
          onValueChange={form.setReactionLevel}
          options={[
            { value: "ack", label: "👀 while working, ⚠️ if it fails" },
            { value: "full", label: "Also ✅ when it is done" },
            { value: "off", label: "No reactions" },
          ]}
        />
      )}
      <FormSelect<ChannelInteractionMode>
        label="When a message arrives"
        description={
          form.interactionMode === "cases"
            ? "Each new thread becomes a case in Triage. Replies are drafted for a person to send."
            : undefined
        }
        value={form.interactionMode}
        disabled={isPending}
        onValueChange={form.setInteractionMode}
        options={[
          { value: "automated", label: "Reply when needed" },
          { value: "direct", label: "Reply to every message" },
          ...(projectId ? [{ value: "cases" as const, label: "Open a case in Triage" }] : []),
        ]}
      />
      {error?.message && (
        <p role="alert" className="text-sm text-failure">
          {error.message}
        </p>
      )}
    </FormDialog>
  );
}
