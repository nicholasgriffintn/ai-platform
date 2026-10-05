import { FormSelect, FormTextarea } from "@ngriffin_uk/polychat-component-ui";

export interface ChannelSettingsFieldsProps {
  senderIds: string;
  replyMode: "mentions" | "all";
  disabled?: boolean;
  onSenderIdsChange: (value: string) => void;
  onReplyModeChange: (value: "mentions" | "all") => void;
}

export function ChannelSettingsFields({
  senderIds,
  replyMode,
  disabled,
  onSenderIdsChange,
  onReplyModeChange,
}: ChannelSettingsFieldsProps) {
  return (
    <>
      <FormTextarea
        label="Allowed senders"
        description="Enter one Slack member ID or Telegram user ID per line. These people can start runs using your access in this scope."
        value={senderIds}
        onChange={(event) => onSenderIdsChange(event.target.value)}
        disabled={disabled}
        required
        rows={3}
      />
      <FormSelect
        label="When to reply"
        description="Mention mode starts a thread when the bot is mentioned, then replies to follow-ups in that thread. Direct messages always start a conversation."
        value={replyMode}
        onValueChange={onReplyModeChange}
        disabled={disabled}
        options={[
          { value: "mentions", label: "Mentions and active threads" },
          { value: "all", label: "All allowed messages" },
        ]}
      />
    </>
  );
}
