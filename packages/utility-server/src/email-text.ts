const QUOTE_HEADER_PATTERNS = [
  /^On .{1,300}wrote:\s*$/,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^_{10,}\s*$/,
];

const FORWARD_SUBJECT_PATTERN = /^fwd?\s*:/i;
const FORWARD_MARKER_PATTERNS = [
  /^-{2,}\s*Forwarded message\s*-{2,}$/i,
  /^Begin forwarded message:$/i,
];

function isQuoteHeader(line: string): boolean {
  return QUOTE_HEADER_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

export function isForwardedEmail(subject: string | undefined, text: string): boolean {
  if (FORWARD_SUBJECT_PATTERN.test(subject?.trim() ?? "")) {
    return true;
  }

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstForward = lines.findIndex((line) =>
    FORWARD_MARKER_PATTERNS.some((pattern) => pattern.test(line.trim())),
  );
  const firstQuote = lines.findIndex(
    (line) => isQuoteHeader(line) || line.trimStart().startsWith(">"),
  );

  return firstForward >= 0 && (firstQuote < 0 || firstForward < firstQuote);
}

export function stripQuotedEmailReply(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cutAt = lines.findIndex(isQuoteHeader);
  const kept = (cutAt < 0 ? lines : lines.slice(0, cutAt)).filter(
    (line) => !line.trimStart().startsWith(">"),
  );

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function replySubject(subject: string | undefined, fallback: string): string {
  const trimmed = subject?.trim();

  if (!trimmed) {
    return fallback;
  }

  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function parseMessageIds(value: string | undefined): string[] {
  return value?.match(/<[^<>\s]+>/g) ?? [];
}
