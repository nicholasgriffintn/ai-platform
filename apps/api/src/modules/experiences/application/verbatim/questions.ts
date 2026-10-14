import type { DecisionQuestions } from "@ngriffin_uk/polychat-schemas";

export const VERBATIM_MAX_JUDGED_WORDS = 56;

export const PACE_LEVELS = ["Very slow", "Slow", "Conversational", "Fast", "Very fast"];
export const NOISE_LEVELS = [
  "Studio clean",
  "Quiet room",
  "Some background",
  "Noisy",
  "Very noisy",
];
export const TONES = {
  neutral: "Neutral, matter-of-fact",
  cheerful: "Cheerful or warm",
  excited: "Excited or animated",
  questioning: "Questioning or uncertain",
  frustrated: "Frustrated or annoyed",
  sad: "Sad or subdued",
} as const;

export const wordQuestionId = (index: number) => `w${index}`;

export function buildSegmentQuestions(words: readonly string[]): DecisionQuestions {
  const questions: DecisionQuestions = {
    speech: {
      type: "noul",
      instructions: "Does the audio contain intelligible human speech?",
    },
    verbatim: {
      type: "noul",
      instructions:
        "Is `transcript` an exact word-for-word match of everything spoken in the audio, with no missing, extra or changed words?",
    },
    fluent: {
      type: "noul",
      instructions:
        "Is `transcript` plausible, fluent English made of natural sentences? A sentence cut off at the very start or end of the clip is fine.",
    },
    coherent: {
      type: "noul",
      instructions: "Does `transcript` read as a plausible continuation of `previous`?",
    },
    pace: {
      type: "score",
      instructions: "How quickly is the speaker talking?",
      criteria: PACE_LEVELS,
    },
    noise: {
      type: "score",
      instructions: "How much background noise is in the audio?",
      criteria: NOISE_LEVELS,
    },
    tone: {
      type: "choice",
      instructions: "Which best describes the speaker's tone of voice?",
      criteria: TONES,
    },
  };

  words.slice(0, VERBATIM_MAX_JUDGED_WORDS).forEach((word, index) => {
    questions[wordQuestionId(index)] = {
      type: "noul",
      instructions: `Word ${index + 1} of \`transcript\` is "${word}". Is that word actually spoken in the audio at that point?`,
    };
  });

  return questions;
}

export function buildRepairQuestions(candidates: Record<string, string>): DecisionQuestions {
  return {
    candidate: {
      type: "choice",
      instructions:
        "Which candidate is the exact word-for-word transcript of what is spoken in the audio, reading as plausible English?",
      criteria: candidates,
    },
  };
}
