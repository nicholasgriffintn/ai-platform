import { FormDialog, FormInput, FormSelect, Switch } from "@ngriffin_uk/polychat-component-ui";
import type { CreateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";

import { useChannelConnectionForm } from "./useChannelConnectionForm.js";

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
          : "Continue your conversations in Slack or Telegram. Personal channels support direct messages only."
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
      <FormSelect<"slack" | "telegram">
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
              ]
        }
      />
      <FormInput
        label={form.channel === "slack" ? "Workspace and channel IDs" : "Private chat ID"}
        description={
          form.channel === "slack"
            ? "Enter the Slack workspace ID and channel ID, separated by a colon."
            : "Enter the ID of your private conversation with the Telegram bot."
        }
        required
        maxLength={200}
        placeholder={form.channel === "slack" ? "T012345:C012345" : "123456789"}
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
      <div className="border-t border-border pt-4">
        <Switch
          label="Reply only when needed"
          description="Turn off to reply to every message."
          checked={form.automated}
          disabled={isPending}
          onChange={(event) => form.setAutomated(event.target.checked)}
        />
      </div>
      {error?.message && (
        <p role="alert" className="text-sm text-failure">
          {error.message}
        </p>
      )}
    </FormDialog>
  );
}
