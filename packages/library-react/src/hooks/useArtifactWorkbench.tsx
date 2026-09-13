import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { ArtifactProps } from "@ngriffin_uk/polychat-utility-react";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useConversationScope } from "../state/conversation-scope.js";
import { useTrackEvent } from "./use-track-event.js";
import { useArtifactPanel } from "./useArtifactPanel.js";

export interface ArtifactWorkbenchValue {
  currentArtifact: ArtifactProps | null;
  currentArtifacts: ArtifactProps[];
  isPanelVisible: boolean;
  isCombinedPanel: boolean;
  openCount: number;
  openArtifact: (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => void;
  replaceArtifact: (artifact: ArtifactProps) => void;
  closePanel: () => void;
  copied: boolean;
  copyArtifact: (value: string) => void;
  artifactAttachments: AttachmentData[];
  addArtifactSelection: (attachment: AttachmentData) => void;
  removeArtifactAttachment: (index: number) => void;
  clearArtifactAttachments: () => void;
  registerComposerFocus: (focus: () => void) => void;
}

const ArtifactWorkbenchContext = createContext<ArtifactWorkbenchValue | null>(null);

export function useArtifactWorkbench(): ArtifactWorkbenchValue {
  const value = useContext(ArtifactWorkbenchContext);

  if (!value) {
    throw new Error("useArtifactWorkbench must be used inside an ArtifactWorkbenchProvider");
  }

  return value;
}

export function ArtifactWorkbenchProvider({ children }: { children: ReactNode }) {
  const { trackFeatureUsage } = useTrackEvent();
  const { currentConversationId } = useConversationScope();
  const { copied, copy: copyArtifact } = useCopyToClipboard();
  const [artifactAttachments, setArtifactAttachments] = useState<AttachmentData[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const composerFocusRef = useRef<(() => void) | null>(null);

  const panel = useArtifactPanel({
    onOpen: (artifact, combined) =>
      trackFeatureUsage("view_artifact", {
        artifact_type: artifact.type,
        conversation_id: currentConversationId || "none",
        combined_view: combined,
      }),
    onClose: (artifact) =>
      trackFeatureUsage("close_artifact", {
        artifact_type: artifact.type,
        conversation_id: currentConversationId || "none",
      }),
  });

  const registerComposerFocus = useCallback((focus: () => void) => {
    composerFocusRef.current = focus;
  }, []);

  const openArtifact = useCallback(
    (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => {
      panel.openArtifact(artifact, combine, artifacts);
      setOpenCount((count) => count + 1);
    },
    [panel],
  );

  const addArtifactSelection = useCallback(
    (attachment: AttachmentData) => {
      setArtifactAttachments((current) => [...current, attachment]);
      composerFocusRef.current?.();

      trackFeatureUsage("add_selection_to_chat", {
        conversation_id: currentConversationId || "none",
        artifact_type: panel.currentArtifact?.type || "unknown",
      });
    },
    [currentConversationId, panel, trackFeatureUsage],
  );

  const removeArtifactAttachment = useCallback((indexToRemove: number) => {
    setArtifactAttachments((current) => current.filter((_, index) => index !== indexToRemove));
  }, []);

  const clearArtifactAttachments = useCallback(() => {
    setArtifactAttachments([]);
  }, []);

  const value = useMemo<ArtifactWorkbenchValue>(
    () => ({
      currentArtifact: panel.currentArtifact,
      currentArtifacts: panel.currentArtifacts,
      isPanelVisible: panel.isPanelVisible,
      isCombinedPanel: panel.isCombinedPanel,
      openCount,
      openArtifact,
      replaceArtifact: panel.replaceArtifact,
      closePanel: panel.closePanel,
      copied,
      copyArtifact,
      artifactAttachments,
      addArtifactSelection,
      removeArtifactAttachment,
      clearArtifactAttachments,
      registerComposerFocus,
    }),
    [
      panel,
      openCount,
      openArtifact,
      copied,
      copyArtifact,
      artifactAttachments,
      addArtifactSelection,
      removeArtifactAttachment,
      clearArtifactAttachments,
      registerComposerFocus,
    ],
  );

  return (
    <ArtifactWorkbenchContext.Provider value={value}>{children}</ArtifactWorkbenchContext.Provider>
  );
}
