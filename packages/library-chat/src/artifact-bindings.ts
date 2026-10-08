import { artifactBindingsSchema, type ArtifactBinding } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

const BINDINGS_BLOCK = /^\s*<bindings>([\s\S]*?)<\/bindings>\s*/;

export interface ExtractedArtifactBindings {
  bindings: ArtifactBinding[];
  code: string;
  error: string | null;
}

export function extractArtifactBindings(content: string): ExtractedArtifactBindings {
  const match = content.match(BINDINGS_BLOCK);

  if (!match) {
    return { bindings: [], code: content, error: null };
  }

  const code = content.slice(match[0].length);
  const parsed = artifactBindingsSchema.safeParse(safeParseJson(match[1]?.trim() ?? ""));

  return parsed.success
    ? { bindings: parsed.data, code, error: null }
    : { bindings: [], code, error: "The artifact's data bindings could not be read." };
}
