import type { OutputRevision } from "@ngriffin_uk/polychat-schemas";

const MAX_COMPARISON_CHARACTERS = 20_000;

export function formatOutputRevisionContent(content: OutputRevision["content"]): string {
  const serialised = JSON.stringify(content, null, 2);

  if (serialised.length <= MAX_COMPARISON_CHARACTERS) {
    return serialised;
  }

  return `${serialised.slice(0, MAX_COMPARISON_CHARACTERS)}\n… comparison truncated`;
}

export function changedOutputRevisionFields(
  current: OutputRevision,
  selected: OutputRevision,
): Array<"title" | "status" | "sensitivity" | "content"> {
  const fields: Array<"title" | "status" | "sensitivity" | "content"> = [];

  if (current.title !== selected.title) {
    fields.push("title");
  }

  if (current.status !== selected.status) {
    fields.push("status");
  }

  if (current.sensitivity !== selected.sensitivity) {
    fields.push("sensitivity");
  }

  if (JSON.stringify(current.content) !== JSON.stringify(selected.content)) {
    fields.push("content");
  }

  return fields;
}
