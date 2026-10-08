import { formattedMessageContent } from "./messages.js";

const ARTIFACT_OPEN = "<artifact";
const ARTIFACT_CLOSE = "</artifact>";
const EDIT_MODE_ATTRIBUTE = /\smode="edit"/i;
const FIND_MARKER = "<<<<<<< FIND\n";
const SEPARATOR_MARKER = "\n=======\n";
const REPLACE_MARKER = ">>>>>>> REPLACE";

export interface ArtifactEdit {
  find: string;
  replace: string;
}

export type ArtifactEditResult = { ok: true; content: string } | { ok: false; error: string };

export function parseArtifactEdits(body: string): ArtifactEdit[] {
  const text = body.replaceAll("\r\n", "\n");
  const edits: ArtifactEdit[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(FIND_MARKER, cursor);
    const separator =
      start === -1 ? -1 : text.indexOf(SEPARATOR_MARKER, start + FIND_MARKER.length);
    const end =
      separator === -1 ? -1 : text.indexOf(REPLACE_MARKER, separator + SEPARATOR_MARKER.length);

    if (start === -1 || separator === -1 || end === -1) {
      break;
    }

    const replace = text.slice(separator + SEPARATOR_MARKER.length, end);

    edits.push({
      find: text.slice(start + FIND_MARKER.length, separator),
      replace: replace.endsWith("\n") ? replace.slice(0, -1) : replace,
    });
    cursor = end + REPLACE_MARKER.length;
  }

  return edits;
}

function countOccurrences(text: string, search: string): number {
  let count = 0;
  let index = text.indexOf(search);

  while (index !== -1 && count < 2) {
    count += 1;
    index = text.indexOf(search, index + search.length);
  }

  return count;
}

export function applyArtifactEdits(previous: string, body: string): ArtifactEditResult {
  const edits = parseArtifactEdits(body);

  if (edits.length === 0) {
    return { ok: false, error: "The edit did not contain any FIND/REPLACE blocks." };
  }

  let content = previous;

  for (const [index, edit] of edits.entries()) {
    if (!edit.find) {
      return { ok: false, error: `Edit ${index + 1} has an empty FIND block.` };
    }

    const occurrences = countOccurrences(content, edit.find);

    if (occurrences !== 1) {
      return {
        ok: false,
        error:
          occurrences === 0
            ? `Edit ${index + 1} looks for text the artifact does not contain.`
            : `Edit ${index + 1} matches more than one place in the artifact.`,
      };
    }

    const at = content.indexOf(edit.find);

    content = `${content.slice(0, at)}${edit.replace}${content.slice(at + edit.find.length)}`;
  }

  return { ok: true, content };
}

export function isArtifactEditTag(attributes: string): boolean {
  return EDIT_MODE_ATTRIBUTE.test(attributes);
}

function readIdentifier(attributes: string): string {
  return attributes.match(/identifier="([^"]*)"/)?.[1] ?? "";
}

export interface ExpandedArtifactEdits {
  content: string;
  changed: boolean;
  failures: string[];
}

export type PreviousArtifactResolver = (identifier: string) => string | null;

export function createArtifactVersionTracker(resolvePrevious: PreviousArtifactResolver) {
  const latest = new Map<string, string>();

  return {
    previous: (identifier: string) => latest.get(identifier) ?? resolvePrevious(identifier),
    record: (identifier: string, content: string) => latest.set(identifier, content),
  };
}

export function expandArtifactEdits(
  text: string,
  tracker: ReturnType<typeof createArtifactVersionTracker>,
): ExpandedArtifactEdits {
  let output = "";
  let cursor = 0;
  let changed = false;
  const failures: string[] = [];

  while (cursor < text.length) {
    const tagStart = text.indexOf(ARTIFACT_OPEN, cursor);
    const tagEnd = tagStart === -1 ? -1 : text.indexOf(">", tagStart);
    const closeIndex = tagEnd === -1 ? -1 : text.indexOf(ARTIFACT_CLOSE, tagEnd + 1);

    if (tagStart === -1 || tagEnd === -1 || closeIndex === -1) {
      break;
    }

    const attributes = text.slice(tagStart + ARTIFACT_OPEN.length, tagEnd);
    const identifier = readIdentifier(attributes);
    const body = text.slice(tagEnd + 1, closeIndex);
    const end = closeIndex + ARTIFACT_CLOSE.length;

    output += text.slice(cursor, tagStart);
    cursor = end;

    if (!identifier || !isArtifactEditTag(attributes)) {
      if (identifier) {
        tracker.record(identifier, body.trim());
      }

      output += text.slice(tagStart, end);
      continue;
    }

    const previous = tracker.previous(identifier);
    const result = previous
      ? applyArtifactEdits(previous, body)
      : { ok: false as const, error: `There is no earlier "${identifier}" artifact to edit.` };

    if (!result.ok) {
      failures.push(`${identifier}: ${result.error}`);
      output += text.slice(tagStart, end);
      continue;
    }

    tracker.record(identifier, result.content);
    output += `${ARTIFACT_OPEN}${attributes.replace(EDIT_MODE_ATTRIBUTE, "")}>\n${result.content}\n${ARTIFACT_CLOSE}`;
    changed = true;
  }

  output += text.slice(cursor);

  return { content: output, changed, failures };
}

export function findLatestArtifactContent(
  messages: ReadonlyArray<{ role: string; content: unknown }>,
  identifier: string,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "assistant" || typeof message.content !== "string") {
      continue;
    }

    const artifact = formattedMessageContent("assistant", message.content)
      .artifacts.filter((candidate) => candidate.identifier === identifier && !candidate.isOpen)
      .at(-1);

    if (artifact) {
      return artifact.content;
    }
  }

  return null;
}
