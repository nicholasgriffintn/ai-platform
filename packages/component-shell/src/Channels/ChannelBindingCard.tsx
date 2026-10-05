import { Button, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus, useChannelSenders } from "@ngriffin_uk/polychat-library-react";
import type { ChannelBinding } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { useChannelPairing } from "./useChannelPairing.js";

export function ChannelBindingCard({
  binding,
  onDisconnect,
  isDisconnecting,
}: {
  binding: ChannelBinding;
  onDisconnect: () => Promise<unknown>;
  isDisconnecting: boolean;
}) {
  const { user } = useAuthStatus();
  const { senders, revoke } = useChannelSenders(binding.id);
  const { challenge, issue } = useChannelPairing(binding.id);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const linked = senders.data?.senders.some(
    (sender) => sender.userId === user?.id && !sender.revokedAt,
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">{binding.label ?? binding.externalId}</h3>
          <p className="text-xs text-muted-foreground">
            {binding.channel === "slack" ? "Slack" : "Telegram"} · {binding.externalId} ·{" "}
            {binding.interactionMode === "automated"
              ? "Replies when needed"
              : "Replies to each message"}
          </p>
        </div>
        {binding.canManage && (
          <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(true)}>
            Disconnect
          </Button>
        )}
      </div>
      <Button
        size="sm"
        disabled={issue.isPending || !binding.enabled}
        onClick={() => issue.mutate()}
      >
        {issue.isPending ? "Preparing link…" : linked ? "Relink my account" : "Link my account"}
      </Button>
      {!binding.enabled && (
        <p className="text-sm text-muted-foreground">
          Reconnect this channel using its Slack workspace and channel IDs.
        </p>
      )}
      {challenge && (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="text-sm">
            Send this command in a private direct message to the bot from your own account. It
            expires in ten minutes. Sending it to a group invalidates it.
          </p>
          <textarea
            aria-label="One-time linking command"
            readOnly
            value={challenge.command}
            className="w-full resize-none rounded border bg-background p-2 font-mono text-xs"
            onFocus={(event) => event.target.select()}
          />
          <p className="text-xs text-muted-foreground">
            The linked account appears below once the command arrives.
          </p>
        </div>
      )}
      {senders.isLoading ? (
        <p className="text-sm">Loading linked accounts…</p>
      ) : !senders.data?.senders.length ? (
        <p className="text-sm text-muted-foreground">No linked accounts yet.</p>
      ) : (
        <ul className="space-y-2">
          {senders.data.senders.map((sender) => (
            <li
              key={sender.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {sender.userId === user?.id ? "Your account" : `Member ${sender.userId}`} ·{" "}
                {sender.senderId} {sender.revokedAt ? "(revoked)" : "(linked)"}
              </span>
              {sender.canRevoke && !sender.revokedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate({ id: sender.id, revision: sender.revision })}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(senders.error || revoke.error || issue.error) && (
        <p role="alert" className="text-sm text-failure">
          {senders.error?.message ?? revoke.error?.message ?? issue.error?.message}
        </p>
      )}
      <ConfirmationDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect channel?"
        description="Block new messages and pending replies, and remove its linked accounts."
        confirmText="Disconnect"
        isLoading={isDisconnecting}
        onConfirm={async () => {
          await onDisconnect();
          setConfirmDisconnect(false);
        }}
      />
    </div>
  );
}
