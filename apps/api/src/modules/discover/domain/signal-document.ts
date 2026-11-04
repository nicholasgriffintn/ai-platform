import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

const SIGNAL_CONTEXT_LINES = 12;
const SIGNAL_CONTEXT_LINE_CHARACTERS = 280;

export interface SignalDocumentInput {
  title: string;
  readAt: string | null;
  lines: readonly string[];
  error: string | null;
}

export function renderSignalDocument(input: SignalDocumentInput): string {
  const parts = [`# ${input.title}`];

  if (input.error) {
    parts.push(`Could not be read: ${input.error}`);
  } else if (input.readAt) {
    parts.push(`Read ${input.readAt.slice(0, 16).replace("T", " ")} UTC.`);
  }

  if (input.lines.length > 0) {
    parts.push(input.lines.map((line) => `- ${line}`).join("\n"));
  } else if (!input.error) {
    parts.push("Nothing new was returned.");
  }

  return parts.join("\n\n");
}

export function condenseSignalLines(lines: readonly string[]): string[] {
  return [...new Set(lines.map((line) => truncateSingleLine(line, SIGNAL_CONTEXT_LINE_CHARACTERS)))]
    .filter(Boolean)
    .slice(0, SIGNAL_CONTEXT_LINES);
}

export function isDiscoverQuotaError(message: string): boolean {
  return /\bquota\b/iu.test(message);
}

export function describeDiscoverSourceError(message: string): string {
  if (isDiscoverQuotaError(message)) {
    return "Its daily quota has run out, so it is paused until tomorrow.";
  }

  if (/\b40[13]\b|unauthori[sz]ed|forbidden/iu.test(message)) {
    return "It needs reconnecting.";
  }

  if (/\b404\b|not found/iu.test(message)) {
    return "It could not find this on your account.";
  }

  if (/composio/iu.test(message)) {
    return "It could not be read just now.";
  }

  const [line = ""] = message.split(/[{\n]/u);

  return line.replace(/[:\s]+$/u, "") || "It could not be read.";
}
