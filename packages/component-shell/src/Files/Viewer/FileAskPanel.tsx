import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  ComposerDraftProvider,
  ConversationScopeProvider,
  useLocalComposerDraft,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_MODEL_TIER, type ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { ConversationArtifactOverlay } from "../../Conversations/ConversationArtifactOverlay.js";
import type { FileItem } from "../Library/file-items.js";
import { buildFileAskSuggestions } from "./ask-suggestions.js";
import type { FileConversationState } from "./useFileViewerPanels.js";
import { useSubjectConversationSync } from "./useSubjectConversationSync.js";

const ASK_PLACEHOLDER = "Ask about this file";
const FOLLOW_UP_PLACEHOLDER = "Ask a follow-up";

export function FileAskPanel({
  subject,
  item,
  projectId,
  conversation,
  attachment,
}: {
  subject: ConversationSubject;
  item: FileItem;
  projectId?: string;
  conversation: FileConversationState;
  attachment?: AttachmentData;
}) {
  const scope = useLocalConversationScope(conversation.conversationId);
  const modelTier = useChatStore((state) => state.modelTier);
  const draft = useLocalComposerDraft();
  const [attachmentDismissed, setAttachmentDismissed] = useState(false);
  const isNew = !scope.currentConversationId;

  useSubjectConversationSync(scope.currentConversationId, subject);

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <ArtifactWorkbenchProvider>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ConversationThread
              modeConfig={{
                surface: "subject",
                welcomeTitle: "What would you like to know?",
                welcomeDescription:
                  "Polychat reads it fresh every time you ask, and keeps the conversation with the file.",
                welcomeSuggestions: buildFileAskSuggestions(item.type),
                welcomeCapabilitySuggestions: false,
                inputPlaceholder: {
                  newConversation: ASK_PLACEHOLDER,
                  followUp: FOLLOW_UP_PLACEHOLDER,
                },
                analyticsSource: "file",
                contextAttachments: isNew && attachment && !attachmentDismissed ? [attachment] : [],
                onRemoveContextAttachment: () => setAttachmentDismissed(true),
                requestOptions: {
                  conversation_subject: subject,
                  model_tier: modelTier ?? DEFAULT_MODEL_TIER,
                  ...(projectId ? { metadata: { project_id: projectId } } : {}),
                },
              }}
            />
            <ConversationArtifactOverlay />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
