import { useChatStore } from "@ngriffin_uk/polychat-library-react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { COMPOSER_PREFILL_PARAM, readComposerPrefill } from "~/lib/composer-prefill";

export function useComposerPrefill(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const setChatInput = useChatStore((state) => state.setChatInput);
  const hasAppliedRef = useRef(false);

  useEffect(() => {
    if (hasAppliedRef.current) {
      return;
    }

    const prompt = readComposerPrefill(searchParams);

    if (!prompt) {
      return;
    }

    hasAppliedRef.current = true;
    setChatInput(prompt);

    const next = new URLSearchParams(searchParams);

    next.delete(COMPOSER_PREFILL_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setChatInput, setSearchParams]);
}
