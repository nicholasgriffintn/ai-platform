export interface SignalDocumentInput {
  title: string;
  readAt: string | null;
  lines: readonly string[];
  error: string | null;
  raw: string | null;
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

  if (input.raw) {
    parts.push(`## Raw\n\n\`\`\`json\n${input.raw}\n\`\`\``);
  }

  return parts.join("\n\n");
}
