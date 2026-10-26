import { describe, expect, it } from "vitest";

import {
  applyLiveTranscript,
  EMPTY_LIVE_DRAFT,
  liveDraftText,
  markLiveDraftSubmitted,
} from "./liveDraft.js";

describe("Verbatim live draft", () => {
  it("hides words already sent with a phrase cut mid-turn", () => {
    let state = applyLiveTranscript(EMPTY_LIVE_DRAFT, { text: "Book the train", isFinal: false });

    state = markLiveDraftSubmitted(state);
    state = applyLiveTranscript(state, { text: "Book the train to Leeds", isFinal: false });

    expect(liveDraftText(state)).toBe("to Leeds");
  });

  it("starts the next turn from its first word", () => {
    let state = applyLiveTranscript(EMPTY_LIVE_DRAFT, { text: "Book the train.", isFinal: true });

    state = markLiveDraftSubmitted(state);
    state = applyLiveTranscript(state, { text: "Then a taxi", isFinal: false });

    expect(liveDraftText(state)).toBe("Then a taxi");
  });
});
