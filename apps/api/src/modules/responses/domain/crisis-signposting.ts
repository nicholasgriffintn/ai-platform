export const CRISIS_SIGNPOST_TEXT =
  "If you're thinking about suicide or harming yourself, or you're worried about someone else, support is available now. If anyone is in immediate danger, call your local emergency number. UK and Ireland: Samaritans on 116 123. US and Canada: call or text 988. Anywhere else: findahelpline.com. An AI can't replace this kind of help.";

const CRISIS_PATTERNS: readonly RegExp[] = [
  /\bsuicid(?:e|al)\b(?!\s+(?:squad|burns?|doors?|linux|missions?|bomb\w*))/,
  /\b(?:kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+myself\b/,
  /\b(?:end|ending|take|taking)\s+my\s+(?:own\s+)?life\b/,
  /\bself[-\s]?(?:harm|harming|injury|injuring)\b/,
  /\b(?:want|wanted|wanting|going|plan|planning|ready)\s+to\s+die\b/,
  /\bwish\s+i\s+(?:was|were)\s+dead\b/,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+alive|be\s+here\s+any\s?more|wake\s+up)\b/,
  /\b(?:no|not\s+any)\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|going\s+on)\b/,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/,
  /\bhow\s+(?:many|much)\b[^.?!\n]{0,60}\b(?:overdose|to\s+die|lethal\s+dose)\b/,
];

const CRISIS_GUARDRAIL_REASON = /self[-\s]?harm|suicid/i;

export function mentionsCrisis(text: string): boolean {
  const normalised = text.toLowerCase().replaceAll("’", "'");

  return CRISIS_PATTERNS.some((pattern) => pattern.test(normalised));
}

export function isCrisisGuardrailReason(reason: string): boolean {
  return CRISIS_GUARDRAIL_REASON.test(reason);
}

export function withCrisisSignpost(text: string): string {
  return text.trim() ? `${CRISIS_SIGNPOST_TEXT}\n\n${text}` : CRISIS_SIGNPOST_TEXT;
}
