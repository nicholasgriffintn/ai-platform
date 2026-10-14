import type {
  ProjectWorkbenchLayout,
  ProjectWorkbenchPane,
  ProjectWorkbenchStatus,
} from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useRef, useState } from "react";

import { STATUS_PRESENTATION } from "./projectWorkbenchPresentation";

export interface ConversationWorkbenchAttention {
  key: string;
  pane?: ProjectWorkbenchPane;
}

export function useProjectWorkbenchAttention({
  attention,
  status,
  hasDock,
  layout,
  contextIsVisible,
  panelsHiddenByRail,
  onMobilePane,
}: {
  attention?: ConversationWorkbenchAttention;
  status: ProjectWorkbenchStatus;
  hasDock: boolean;
  layout: ProjectWorkbenchLayout;
  contextIsVisible: boolean;
  panelsHiddenByRail: boolean;
  onMobilePane: (pane: ProjectWorkbenchPane | null) => void;
}) {
  const [seenContextKey, setSeenContextKey] = useState<string>();
  const [prevMobileAttentionKey, setPrevMobileAttentionKey] = useState<string>();
  const [prevMobileStatus, setPrevMobileStatus] = useState(status);
  const handledAttentionKey = useRef<string | undefined>(undefined);
  const handledStatus = useRef<ProjectWorkbenchStatus | undefined>(undefined);
  const statusRequiresAttention = STATUS_PRESENTATION[status].requiresAttention === true;
  const contextAttentionKey = attention && !attention.pane ? attention.key : undefined;
  const attentionKey = attention?.key;
  const attentionPane = attention?.pane;
  const { openPane, setContextOpen } = layout;

  if (contextIsVisible && contextAttentionKey && seenContextKey !== contextAttentionKey) {
    setSeenContextKey(contextAttentionKey);
  }

  if (prevMobileAttentionKey !== attentionKey) {
    setPrevMobileAttentionKey(attentionKey);

    if (attentionPane && !hasDock) {
      onMobilePane(attentionPane);
    }
  }

  if (prevMobileStatus !== status) {
    setPrevMobileStatus(status);

    if (statusRequiresAttention && !hasDock) {
      onMobilePane(null);
    }
  }

  useEffect(() => {
    if (!attentionKey || !attentionPane || handledAttentionKey.current === attentionKey) {
      return;
    }

    handledAttentionKey.current = attentionKey;
    openPane(attentionPane);

    if (panelsHiddenByRail) {
      setContextOpen(false);
    }
  }, [attentionKey, attentionPane, panelsHiddenByRail, openPane, setContextOpen]);

  useEffect(() => {
    if (handledStatus.current === status) {
      return;
    }

    handledStatus.current = status;

    if (statusRequiresAttention && hasDock) {
      setContextOpen(true);
    }
  }, [hasDock, setContextOpen, status, statusRequiresAttention]);

  return {
    hasUnseenContext: Boolean(contextAttentionKey && seenContextKey !== contextAttentionKey),
  };
}
