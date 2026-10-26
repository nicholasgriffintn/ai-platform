export const RECENTLY_NOTED_HEADING = "## Recently noted";
export const MEMORY_APPEND_CHARACTERS = 6_000;

export function hasRecentNotes(content: string): boolean {
  return (
    content.includes(`\n${RECENTLY_NOTED_HEADING}\n`) || content.startsWith(RECENTLY_NOTED_HEADING)
  );
}

export function shouldAppendMemory(content: string): boolean {
  return content.length >= MEMORY_APPEND_CHARACTERS || hasRecentNotes(content);
}

export function appendRecentNote(content: string, note: string, date: string): string {
  const line = `- ${date}: ${note.trim().replace(/\s+/g, " ")}`;

  return hasRecentNotes(content)
    ? `${content.trimEnd()}\n${line}`
    : `${content.trimEnd()}\n\n${RECENTLY_NOTED_HEADING}\n\n${line}`;
}

export function splitRecentNotes(content: string): { body: string; notes: string } {
  const index = content.startsWith(RECENTLY_NOTED_HEADING)
    ? 0
    : content.indexOf(`\n${RECENTLY_NOTED_HEADING}\n`);

  if (index < 0) {
    return { body: content, notes: "" };
  }

  return {
    body: content.slice(0, index).trimEnd(),
    notes: content.slice(index).replace(RECENTLY_NOTED_HEADING, "").trim(),
  };
}
