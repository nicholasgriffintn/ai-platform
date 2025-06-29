/**
 * Utilities for handling QwQ model responses
 * QwQ models generate thinking content but don't include the opening <think> tag
 */

/**
 * Preprocesses QwQ model responses to ensure proper <think> tag formatting
 * @param content - The response content to preprocess
 * @param model - The model identifier
 * @returns The preprocessed content with <think> tag if needed
 */
export function preprocessQwQResponse(content: string, model?: string): string {
  if (!model || !content) {
    return content;
  }

  const isQwQModel = model.toLowerCase().includes("qwq");
  if (!isQwQModel) {
    return content;
  }

  const hasClosingThink = content.includes("</think>");
  const startsWithThink = content.trim().startsWith("<think>");

  if (hasClosingThink && !startsWithThink) {
    return `<think>\n${content}`;
  }

  return content;
}
