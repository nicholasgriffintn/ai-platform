import type { Correction } from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export function quoteAppearsIn(quote: string, texts: readonly string[]): boolean {
  const needle = normaliseComparableText(quote);

  return needle.length > 0 && texts.some((text) => normaliseComparableText(text).includes(needle));
}

export function findExactRecurrence(
  corrections: readonly Correction[],
  pattern: string,
): Correction | null {
  const normalised = normaliseComparableText(pattern);

  return (
    corrections.find((correction) => normaliseComparableText(correction.pattern) === normalised) ??
    null
  );
}
