import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";

export type FileViewerDrawer =
  | "info"
  | "sources"
  | "history"
  | "comments"
  | "conversations"
  | "sharing";

export interface FileConversationState {
  key: string;
  conversationId?: string;
}

const WIDE_VIEWER_QUERY = "(min-width: 1024px)";

export function useFileViewerPanels() {
  const [drawer, setDrawer] = useState<FileViewerDrawer | null>(null);
  const isWide = useMediaQuery(WIDE_VIEWER_QUERY);
  const [askingChoice, setAskingChoice] = useState<boolean | null>(null);
  const isAsking = askingChoice ?? isWide;
  const [conversation, setConversation] = useState<FileConversationState>(() => ({
    key: generateId(),
  }));

  return {
    drawer,
    isAsking,
    conversation,
    openDrawer: (next: FileViewerDrawer) => setDrawer(next),
    closeDrawer: () => setDrawer(null),
    toggleAsking: () => {
      setDrawer(null);
      setAskingChoice(!isAsking);
    },
    hideAsking: () => setAskingChoice(false),
    startConversation: () => {
      setConversation({ key: generateId() });
      setDrawer(null);
      setAskingChoice(true);
    },
    resumeConversation: (conversationId: string) => {
      setConversation({ key: conversationId, conversationId });
      setDrawer(null);
      setAskingChoice(true);
    },
  };
}

export type FileViewerPanels = ReturnType<typeof useFileViewerPanels>;
