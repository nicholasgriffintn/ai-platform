import {
  consumePolyPrompt,
  usePolyPrompt,
  type ComposerDraft,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect } from "react";

export function usePolyComposerPrefill(draft: ComposerDraft): void {
  const prompt = usePolyPrompt((state) => state.prompt);

  useEffect(() => {
    if (!prompt) {
      return;
    }

    draft.setComposerInput([draft.composerInput, prompt].filter(Boolean).join("\n\n"));
    consumePolyPrompt(prompt);
  }, [draft, prompt]);
}
