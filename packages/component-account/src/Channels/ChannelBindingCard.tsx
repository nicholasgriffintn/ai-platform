import { Badge, Button, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  channelSenderIdsSchema,
  type ChannelBinding,
  type UpdateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { ChannelSettingsFields } from "./ChannelSettingsFields";

export interface ChannelBindingCardProps {
  binding: ChannelBinding;
  isSaving: boolean;
  isDeleting: boolean;
  onUpdate: (input: UpdateChannelBindingInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ChannelBindingCard({
  binding,
  isSaving,
  isDeleting,
  onUpdate,
  onDelete,
}: ChannelBindingCardProps) {
  const [senderIds, setSenderIds] = useState(binding.allowedSenderIds.join("\n"));
  const [replyMode, setReplyMode] = useState(binding.replyMode);
  const [enabled, setEnabled] = useState(binding.enabled);
  const [error, setError] = useState<string | null>(null);
  const needsReconnect =
    (binding.channel === "slack" && !binding.workspaceId) || binding.allowedSenderIds.length === 0;
  const busy = isSaving || isDeleting;
  const save = async () => {
    const ids = channelSenderIdsSchema.safeParse(splitNonEmptyLines(senderIds));

    if (!ids.success) {
      setError(ids.error.issues[0]?.message ?? "Check the allowed senders");

      return;
    }

    setError(null);
    try {
      await onUpdate({
        expectedRevision: binding.revision,
        allowedSenderIds: ids.data,
        replyMode,
        enabled,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save channel settings");
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await onDelete();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not disconnect this channel");
    }
  };

  return (
    <article className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{binding.label ?? binding.externalId}</p>
          <p className="text-xs text-muted-foreground">
            {binding.channel === "slack" ? "Slack" : "Telegram"} · {binding.externalId}
            {binding.workspaceId ? ` · ${binding.workspaceId}` : ""}
          </p>
        </div>
        <Badge variant="outline">{binding.enabled ? "Connected" : "Paused"}</Badge>
      </div>
      {needsReconnect ? (
        <p className="text-sm text-muted-foreground">
          Disconnect this binding and create it again with its workspace and allowed senders.
        </p>
      ) : (
        <>
          <ChannelSettingsFields
            senderIds={senderIds}
            replyMode={replyMode}
            disabled={busy}
            onSenderIdsChange={setSenderIds}
            onReplyModeChange={setReplyMode}
          />
          <Switch
            label="Receive messages"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={busy}
          />
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-failure">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {!needsReconnect ? (
          <Button
            variant="primary"
            onClick={() => void save()}
            isLoading={isSaving}
            disabled={busy}
          >
            Save settings
          </Button>
        ) : null}
        <Button
          variant="destructive"
          onClick={() => void remove()}
          isLoading={isDeleting}
          disabled={busy}
        >
          Disconnect
        </Button>
      </div>
    </article>
  );
}
