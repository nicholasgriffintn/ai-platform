import { Badge, Button, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  useAuthStatus,
  useChannelPairing,
  useChannelSenders,
} from "@ngriffin_uk/polychat-library-react";
import type { ChannelBinding } from "@ngriffin_uk/polychat-schemas";
import { Hash, Link2, Mail, Send, Unplug } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "../Content/CopyButton.js";

const CHANNEL_LABELS: Record<ChannelBinding["channel"], string> = {
  slack: "Slack",
  telegram: "Telegram",
  email: "Email",
  sms: "SMS",
};

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
  const { challenge, issue } = useChannelPairing(binding.id);
  const { senders, revoke } = useChannelSenders(binding.id, Boolean(challenge));
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const linked = senders.data?.senders.some(
    (sender) => sender.userId === user?.id && !sender.revokedAt,
  );

  return (
    <div className="min-w-0 space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-selection p-2 text-muted-foreground">
            {binding.channel === "slack" ? (
              <Hash size={17} aria-hidden="true" />
            ) : binding.channel === "email" ? (
              <Mail size={17} aria-hidden="true" />
            ) : (
              <Send size={17} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold break-words">
              {binding.label ?? binding.externalId}
            </h3>
            <p className="text-xs text-muted-foreground">
              {CHANNEL_LABELS[binding.channel]} ·{" "}
              {binding.interactionMode === "automated"
                ? "Replies when needed"
                : "Replies to each message"}
            </p>
            <p className="text-xs break-all text-muted-foreground">{binding.externalId}</p>
            {binding.contactAddress && (
              <p className="text-xs break-all text-muted-foreground">
                Write to {binding.contactAddress}
              </p>
            )}
          </div>
        </div>
        <Badge variant={binding.enabled ? "success" : "warning"}>
          {binding.enabled ? "Connected" : "Needs reconnection"}
        </Badge>
      </div>
      {!binding.enabled && (
        <p className="text-xs text-muted-foreground">
          {binding.canManage
            ? "Use Connect channel to reconnect with the current channel IDs."
            : "Ask a workspace owner or admin to reconnect this channel."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {binding.enabled && (
          <Button
            size="sm"
            variant="outline"
            icon={<Link2 size={14} />}
            disabled={issue.isPending}
            onClick={() => issue.mutate()}
          >
            {issue.isPending ? "Preparing link…" : linked ? "Relink my account" : "Link my account"}
          </Button>
        )}
        {binding.canManage && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Unplug size={14} />}
            className="sm:ml-auto"
            disabled={isDisconnecting}
            onClick={() => setConfirmDisconnect(true)}
          >
            Disconnect
          </Button>
        )}
      </div>
      {challenge && (
        <div className="space-y-3 rounded-lg bg-selection p-3">
          <p className="text-sm">
            {binding.channel === "email"
              ? `Email this command as the subject, from ${binding.externalId} to ${binding.contactAddress ?? "Polychat"}. It expires in ten minutes.`
              : "Send this command in a private direct message to the bot from your own account. It expires in ten minutes. Sending it to a group invalidates it."}
          </p>
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-3">
            <code className="min-w-0 flex-1 text-xs break-all">{challenge.command}</code>
            <CopyButton value={challenge.command} label="Copy linking command" variant="icon" />
          </div>
          <p className="text-xs text-muted-foreground">
            The linked account appears below once the command arrives.
          </p>
        </div>
      )}
      {senders.isLoading ? (
        <p role="status" className="text-xs text-muted-foreground">
          Loading linked accounts…
        </p>
      ) : senders.error ? null : !senders.data?.senders.length ? (
        binding.enabled && (
          <p className="text-xs text-muted-foreground">
            Link your account to send messages with your Polychat permissions.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {senders.data.senders.map((sender) => (
            <li
              key={sender.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {sender.userId === user?.id ? "Your account" : `Member ${sender.userId}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {sender.revokedAt ? "Revoked" : "Linked"}
                  </span>
                </p>
                <p className="text-xs break-all text-muted-foreground">{sender.senderId}</p>
              </div>
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
