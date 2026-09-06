import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import { useChatStore } from "~/state/stores/chatStore";

export interface ComposerDraft {
  composerInput: string;
  setComposerInput: (value: string) => void;
}

const ComposerDraftContext = createContext<ComposerDraft | null>(null);

export function ComposerDraftProvider({
  children,
  draft,
}: {
  children: ReactNode;
  draft: ComposerDraft;
}) {
  return <ComposerDraftContext.Provider value={draft}>{children}</ComposerDraftContext.Provider>;
}

export function useLocalComposerDraft(): ComposerDraft {
  const [composerInput, setComposerInput] = useState("");

  return useMemo(() => ({ composerInput, setComposerInput }), [composerInput]);
}

export function useComposerDraft(): ComposerDraft {
  const scoped = useContext(ComposerDraftContext);
  const chatInput = useChatStore((state) => state.chatInput);
  const setChatInput = useChatStore((state) => state.setChatInput);
  const storeDraft = useMemo<ComposerDraft>(
    () => ({ composerInput: chatInput, setComposerInput: setChatInput }),
    [chatInput, setChatInput],
  );

  return scoped ?? storeDraft;
}
