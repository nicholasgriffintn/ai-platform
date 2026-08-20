import { ChatMessageView } from "@ngriffin_uk/polychat-component-conversation";
import type { ComponentProps } from "react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { apiService } from "~/lib/api/api-service";

import { InlineModelSelector } from "../InlineModelSelector";

type ChatMessageProps = Omit<
  ComponentProps<typeof ChatMessageView>,
  "copied" | "onCopy" | "onSubmitFeedback" | "renderModelSelector"
>;

export function ChatMessage(props: ChatMessageProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <ChatMessageView
      {...props}
      copied={copied}
      onCopy={copy}
      onSubmitFeedback={async (value) => {
        if (!props.conversationId || !props.message.log_id) {
          return;
        }

        await apiService.submitFeedback(props.conversationId, props.message.log_id, value);
      }}
      renderModelSelector={({ onModelSelect, onCancel }) => (
        <InlineModelSelector onModelSelect={onModelSelect} onCancel={onCancel} className="w-full" />
      )}
    />
  );
}
