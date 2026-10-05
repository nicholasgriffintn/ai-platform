import { Button, Input, Label } from "@ngriffin_uk/polychat-component-ui";
import type { CreateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";

import { useChannelConnectionForm } from "./useChannelConnectionForm.js";

export function ChannelConnectionForm({
  projectId,
  teammates,
  onCreate,
}: {
  projectId?: string;
  teammates: { id: string; name: string }[];
  onCreate: (input: CreateChannelBindingInput) => Promise<unknown>;
}) {
  const form = useChannelConnectionForm(onCreate, projectId);

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Service
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={form.channel}
            disabled={form.busy}
            onChange={(event) => {
              if (event.target.value === "slack" || event.target.value === "telegram") {
                form.setChannel(event.target.value);
              }
            }}
          >
            <option value="slack">Slack</option>
            {!projectId && <option value="telegram">Telegram</option>}
          </select>
        </Label>
        <Label>
          {form.channel === "slack" ? "Slack workspace:channel IDs" : "Telegram private chat ID"}
          <Input
            className="mt-1"
            required
            maxLength={200}
            placeholder={form.channel === "slack" ? "T012345:C012345" : "123456789"}
            value={form.externalId}
            disabled={form.busy}
            onChange={(event) => form.setExternalId(event.target.value)}
          />
        </Label>
        <Label>
          Label
          <Input
            className="mt-1"
            maxLength={120}
            value={form.label}
            disabled={form.busy}
            onChange={(event) => form.setLabel(event.target.value)}
          />
        </Label>
        <Label>
          Reply as
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={form.teammateId}
            disabled={form.busy}
            onChange={(event) => form.setTeammateId(event.target.value)}
          >
            <option value="">Polychat assistant</option>
            {teammates.map((teammate) => (
              <option key={teammate.id} value={teammate.id}>
                {teammate.name}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.automated}
          disabled={form.busy}
          onChange={(event) => form.setAutomated(event.target.checked)}
        />
        Reply only when a message needs a response
      </label>
      <p className="text-xs text-muted-foreground">
        The deployment must have its bot and webhook configured. Personal channels accept direct
        messages only. Each sender links their own account after connection.
      </p>
      {form.error && (
        <p role="alert" className="text-sm text-failure">
          {form.error}
        </p>
      )}
      <Button type="submit" disabled={form.busy}>
        {form.busy ? "Connecting…" : "Connect channel"}
      </Button>
    </form>
  );
}
