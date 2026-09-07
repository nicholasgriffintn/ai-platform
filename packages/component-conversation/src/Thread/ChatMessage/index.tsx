import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-library-react";
import type { ComponentProps } from "react";

import { ChatMessageView } from "../../Message/ChatMessageView.js";
import { InlineModelSelector } from "../InlineModelSelector.js";

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
