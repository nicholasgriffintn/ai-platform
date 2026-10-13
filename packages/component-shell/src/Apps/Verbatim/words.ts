import type { VerbatimWord } from "@ngriffin_uk/polychat-schemas";

export function keyedWords(words: readonly VerbatimWord[]) {
  let offset = 0;

  return words.map((word, position) => {
    const key = `${offset}:${word.text}`;

    offset += word.text.length + 1;

    return { key, word, position };
  });
}
