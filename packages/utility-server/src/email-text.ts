const QUOTE_HEADER_PATTERNS = [
  /^On .{1,300}wrote:\s*$/,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^_{10,}\s*$/,
];

export function stripQuotedEmailReply(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cutAt = lines.findIndex((line) =>
    QUOTE_HEADER_PATTERNS.some((pattern) => pattern.test(line.trim())),
  );
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
