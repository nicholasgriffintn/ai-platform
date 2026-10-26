import { formatTextWithSpacing } from "@ngriffin_uk/polychat-utility-core";

export const DICTATION_PARAGRAPH_PAUSE_MS = 1000;
export const DICTATION_PARAGRAPH_SENTENCES = 6;
export const DICTATION_PARAGRAPH_TURN_SENTENCES = 2;

const SENTENCE_END = /[.!?…]["'”’)\]]*(?=\s)/g;
const ATTACHES_TO_PREVIOUS = /^[\s,.!?;:…)\]}"'”’%]/;
const OPENS_NEXT = /[\s([{"'“‘]$/;

export function appendDictation(current: string, phrase: string, startsParagraph: boolean): string {
  if (!current.trim()) {
    return phrase;
  }

  return startsParagraph
    ? `${current.trimEnd()}\n\n${phrase}`
    : formatTextWithSpacing(current, phrase);
}

export function joinTranscriptFragment(previous: string, fragment: string): string {
  if (!previous || ATTACHES_TO_PREVIOUS.test(fragment) || OPENS_NEXT.test(previous)) {
    return previous + fragment;
  }

  return `${previous} ${fragment}`;
}

export function splitFinishedSentences(text: string): { finished: string; rest: string } {
  let end = -1;

  for (const match of text.matchAll(SENTENCE_END)) {
    end = match.index + match[0].length;
  }

  return end === -1
    ? { finished: "", rest: text }
    : { finished: text.slice(0, end), rest: text.slice(end) };
}

export function countSentences(text: string): number {
  return [...`${text} `.matchAll(SENTENCE_END)].length;
}

function comparableWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
}

export function unwrittenRemainder(finalText: string, written: string): string {
  const writtenWords = comparableWords(written).length;

  if (writtenWords === 0) {
    return finalText.trim();
  }

  let seen = 0;
  const tokens = finalText.trim().split(/(\s+)/);

  for (let index = 0; index < tokens.length; index += 1) {
    if (seen >= writtenWords) {
      return tokens.slice(index).join("").trim();
    }

    if (comparableWords(tokens[index]).length > 0) {
      seen += 1;
    }
  }

  return "";
}
