import {
  listConversationArtifacts,
  summariseConversationUsage,
} from "@ngriffin_uk/polychat-library-chat/conversation-insights";
import { useChat, useModels } from "@ngriffin_uk/polychat-library-react";
import {
  createModelReferenceMap,
  getModelByReference,
  type ChatContextSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

export function useConversationWorkbenchContext(conversationId: string | undefined) {
  const { data: conversation } = useChat(conversationId);
  const { data: models } = useModels();
  const references = useMemo(() => createModelReferenceMap(models ?? {}), [models]);
  const messages = conversation?.messages;
  const usage = useMemo(
    () =>
      summariseConversationUsage(messages ?? [], (model) => getModelByReference(references, model)),
    [messages, references],
  );
  const artifacts = useMemo(() => listConversationArtifacts(messages ?? []), [messages]);
  const latestResponse = conversation?.latest_response;
  const [lastSnapshot, setLastSnapshot] = useState<ChatContextSnapshot | null>(null);
  const currentSnapshot = latestResponse?.context ?? null;

  if (currentSnapshot && currentSnapshot !== lastSnapshot) {
    setLastSnapshot(currentSnapshot);
  }

  const snapshot =
    currentSnapshot ?? (lastSnapshot?.conversationId === conversationId ? lastSnapshot : null);
  const model = snapshot?.model ?? usage.latestModel ?? conversation?.model ?? undefined;
  const provider = snapshot?.provider ?? usage.latestProvider;
  const modelConfig = getModelByReference(references, model, provider);
  const fallback = {
    inputTokens: usage.latestInputTokens,
    contextWindow: modelConfig?.contextWindow,
  };
  const measured = snapshot
    ? { inputTokens: snapshot.usage.inputTokens, contextWindow: snapshot.usage.contextWindow }
    : fallback.inputTokens && fallback.contextWindow
      ? { inputTokens: fallback.inputTokens, contextWindow: fallback.contextWindow }
      : undefined;

  return {
    conversation,
    snapshot,
    runUsage: latestResponse?.usage,
    usage,
    artifacts,
    model,
    provider: modelConfig?.provider ?? provider,
    modelConfig,
    fallback,
    usageLabel: measured
      ? `${Math.round(getBoundedPercentage(measured.inputTokens, measured.contextWindow))}%`
      : undefined,
  };
}

export type ConversationWorkbenchContext = ReturnType<typeof useConversationWorkbenchContext>;
