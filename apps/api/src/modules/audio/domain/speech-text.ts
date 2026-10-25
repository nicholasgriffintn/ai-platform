const MAX_SPEECH_CHARACTERS = 1800;
const WORDS_PER_MINUTE = 150;

export function splitForSpeech(text: string, maxCharacters = MAX_SPEECH_CHARACTERS): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      pieces.push(current);
    }

    for (let start = 0; start < sentence.length; start += maxCharacters) {
      const slice = sentence.slice(start, start + maxCharacters);

      if (start + maxCharacters >= sentence.length) {
        current = slice;
      } else {
        pieces.push(slice);
      }
    }
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

export function estimateSpokenSeconds(texts: readonly string[]): number {
  const words = texts.reduce((total, text) => total + text.split(/\s+/).length, 0);

  return Math.round((words / WORDS_PER_MINUTE) * 60);
}
