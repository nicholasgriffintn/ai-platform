export function chunkText(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    const splitPos = Math.max(
      text.lastIndexOf("\n", end),
      text.lastIndexOf(" ", end),
    );
    if (splitPos > start) {
      end = splitPos;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
