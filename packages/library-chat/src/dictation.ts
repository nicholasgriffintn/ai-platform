export const DICTATION_MODES = ["verbatim", "tidy", "professional", "terminal"] as const;

export type DictationMode = (typeof DICTATION_MODES)[number];

export const DEFAULT_DICTATION_MODE: DictationMode = "tidy";

export interface DictationModeOption {
  id: DictationMode;
  label: string;
  description: string;
}

export const DICTATION_MODE_OPTIONS: readonly DictationModeOption[] = [
  {
    id: "verbatim",
    label: "Verbatim",
    description: "Exactly what you said, fillers and all.",
  },
  {
    id: "tidy",
    label: "Tidy up",
    description: "Drops ums and ers, fixes the spacing and the capitals.",
  },
  {
    id: "professional",
    label: "Professional",
    description: "Tidied, with spoken contractions written out in full.",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Tidied, lower case, and no full stop at the end.",
  },
];

const ALWAYS_FILLERS = ["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm"];

const CLAUSE_FILLERS = [
  "like",
  "so",
  "basically",
  "actually",
  "literally",
  "you know",
  "i mean",
  "sort of",
  "kind of",
];

const CONTRACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bcan't\b/giu, "cannot"],
  [/\bwon't\b/giu, "will not"],
  [/\bdon't\b/giu, "do not"],
  [/\bdoesn't\b/giu, "does not"],
  [/\bdidn't\b/giu, "did not"],
  [/\bisn't\b/giu, "is not"],
  [/\baren't\b/giu, "are not"],
  [/\bwasn't\b/giu, "was not"],
  [/\bit's\b/giu, "it is"],
  [/\bthat's\b/giu, "that is"],
  [/\bwe're\b/giu, "we are"],
  [/\bthey're\b/giu, "they are"],
  [/\bi'm\b/giu, "I am"],
  [/\bi'll\b/giu, "I will"],
  [/\bgonna\b/giu, "going to"],
  [/\bwanna\b/giu, "want to"],
];

function fillerAlternation(fillers: readonly string[]): string {
  return fillers.map((filler) => filler.replaceAll(" ", "\\s+")).join("|");
}

const ALWAYS_FILLER_PATTERN = new RegExp(
  `(^|[\\s,])(?:${fillerAlternation(ALWAYS_FILLERS)})(?=[\\s,.!?]|$)`,
  "giu",
);

const CLAUSE_FILLER_PATTERN = new RegExp(
  `(^|[,.!?]\\s*)\\s*(?:${fillerAlternation(CLAUSE_FILLERS)})(?=[\\s,]|$)`,
  "giu",
);

function applyUntilStable(text: string, pattern: RegExp): string {
  let previous = text;
  let next = text.replace(pattern, "$1");

  while (next !== previous) {
    previous = next;
    next = next.replace(pattern, "$1");
  }

  return next;
}

function removeFillers(text: string): string {
  return applyUntilStable(applyUntilStable(text, ALWAYS_FILLER_PATTERN), CLAUSE_FILLER_PATTERN);
}

function collapseRepeatedWords(text: string): string {
  return text.replace(/\b(\p{L}+)(\s+\1\b)+/giu, "$1");
}

function tidySpacing(text: string): string {
  return text
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.!?;:])/gu, "$1")
    .replace(/([,;:])(?=\p{L})/gu, "$1 ")
    .replace(/^[\s,]+/u, "")
    .trim();
}

function capitaliseSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function tidy(text: string): string {
  return capitaliseSentences(tidySpacing(collapseRepeatedWords(removeFillers(text))));
}

export function cleanDictatedText(text: string, mode: DictationMode): string {
  if (mode === "verbatim") {
    return text;
  }

  const tidied = tidy(text);

  if (mode === "professional") {
    return capitaliseSentences(
      CONTRACTIONS.reduce(
        (result, [pattern, replacement]) => result.replace(pattern, replacement),
        tidied,
      ),
    );
  }

  if (mode === "terminal") {
    return tidied.toLowerCase().replace(/[.]+$/u, "");
  }

  return tidied;
}
