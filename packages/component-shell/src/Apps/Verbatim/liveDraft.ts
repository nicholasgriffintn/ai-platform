import { splitWords } from "@ngriffin_uk/polychat-utility-core";

export interface LiveDraftState {
  turnWords: string[];
  submittedWords: number;
  turnEnded: boolean;
}

export const EMPTY_LIVE_DRAFT: LiveDraftState = {
  turnWords: [],
  submittedWords: 0,
  turnEnded: false,
};

export function applyLiveTranscript(
  state: LiveDraftState,
  transcript: { text: string; isFinal: boolean },
): LiveDraftState {
  return {
    turnWords: splitWords(transcript.text),
    submittedWords: state.turnEnded ? 0 : state.submittedWords,
    turnEnded: transcript.isFinal,
  };
}

export function markLiveDraftSubmitted(state: LiveDraftState): LiveDraftState {
  return { ...state, submittedWords: state.turnWords.length };
}

export function liveDraftText(state: LiveDraftState): string {
  return state.turnWords.slice(state.submittedWords).join(" ");
}
