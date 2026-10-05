export interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
}

export type TextAnchorMatch =
  | { status: "located"; start: number; end: number }
  | { status: "missing" | "ambiguous" };

export function createTextAnchor(text: string, start: number, end: number): TextAnchor {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > text.length
  ) {
    throw new RangeError("Select a non-empty range inside the text");
  }

  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - 64), start),
    suffix: text.slice(end, end + 64),
  };
}

export function locateTextAnchor(text: string, anchor: TextAnchor): TextAnchorMatch {
  if (!anchor.quote) {
    return { status: "missing" };
  }

  let bestStart = -1;
  let bestScore = -1;
  let tied = false;
  let start = text.indexOf(anchor.quote);

  while (start !== -1) {
    let prefixLength = 0;
    let suffixLength = 0;

    while (
      prefixLength < anchor.prefix.length &&
      start - prefixLength > 0 &&
      text[start - prefixLength - 1] === anchor.prefix[anchor.prefix.length - prefixLength - 1]
    ) {
      prefixLength += 1;
    }

    while (
      suffixLength < anchor.suffix.length &&
      text[start + anchor.quote.length + suffixLength] === anchor.suffix[suffixLength]
    ) {
      suffixLength += 1;
    }

    const score = prefixLength + suffixLength;

    if (score > bestScore) {
      bestStart = start;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }

    start = text.indexOf(anchor.quote, start + 1);
  }

  if (bestStart === -1) {
    return { status: "missing" };
  }

  return tied
    ? { status: "ambiguous" }
    : { status: "located", start: bestStart, end: bestStart + anchor.quote.length };
}
