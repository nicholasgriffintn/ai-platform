import {
  readHandoffTeammateId,
  readReplyTeammateId,
} from "@ngriffin_uk/polychat-library-chat/handoffs";
import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { usePetStore, useTeammates } from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_PET_PRESET_SLUG } from "@ngriffin_uk/polychat-schemas";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import type { ComponentProps } from "react";

import { ChatMessageView } from "../../Message/ChatMessageView.js";
import { InlineModelSelector } from "../InlineModelSelector.js";

type ChatMessageProps = Omit<
  ComponentProps<typeof ChatMessageView>,
  | "attribution"
  | "copied"
  | "onCopy"
  | "onReact"
  | "onReactionMood"
  | "viewerId"
  | "renderModelSelector"
>;

export function ChatMessage(props: ChatMessageProps) {
  const { copied, copy } = useCopyToClipboard();
  const viewerId = useChatStore((state) => state.user?.id);
  const reactTo = usePetStore((state) => state.reactTo);
  const { teammates } = useTeammates();
  const teammateId = readReplyTeammateId(props.message) ?? readHandoffTeammateId(props.message);
  const teammate = teammateId
    ? teammates.find((candidate) => candidate.id === teammateId)
    : undefined;

  return (
    <ChatMessageView
      {...props}
      attribution={
        teammate
          ? {
              teammateId: teammate.id,
              name: teammate.name,
              characterId: teammate.character_id ?? DEFAULT_PET_PRESET_SLUG,
            }
          : undefined
      }
      copied={copied}
      onCopy={copy}
      viewerId={viewerId === undefined ? undefined : String(viewerId)}
      onReact={async (emoji, remove) => {
        if (!props.conversationId || !props.message.id) {
          return undefined;
        }

        return apiService.reactToItem(props.conversationId, {
          item_id: props.message.id,
          emoji,
          remove,
        });
      }}
      onReactionMood={reactTo}
      renderModelSelector={({ onModelSelect, onCancel }) => (
        <InlineModelSelector onModelSelect={onModelSelect} onCancel={onCancel} className="w-full" />
      )}
    />
  );
}
