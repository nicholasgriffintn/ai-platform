export function modelEmitsUnterminatedThinking(model?: string): boolean {
  return Boolean(model) && model.toLowerCase().includes("qwq");
}

export function preprocessQwQResponse(content: string, model?: string): string {
  if (!modelEmitsUnterminatedThinking(model) || !content) {
    return content;
  }

  const hasClosingThink = content.includes("</think>");
  const startsWithThink = content.trim().startsWith("<think>");

  return hasClosingThink && !startsWithThink ? `<think>\n${content}` : content;
}
