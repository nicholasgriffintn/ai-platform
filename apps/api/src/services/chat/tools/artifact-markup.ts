export const ARTIFACT_MARKUP_TOOL_CORRECTION =
  "Artifacts are response markup, not tools. Return the artifact as assistant text using <artifact ...>...</artifact>.";

export const ARTIFACT_MARKUP_FINAL_ANSWER_NOTICE =
  "Artifacts are response markup, not tools. Do not call another tool. Return the requested artifact now as assistant text using <artifact ...>...</artifact>.";

export function isArtifactMarkupToolName(name: unknown): boolean {
  return typeof name === "string" && /(^|[_<])artifacts?(?:$|[_<])/i.test(name.trim());
}
