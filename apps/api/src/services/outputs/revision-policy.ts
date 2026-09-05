import type { OutputRestoreCapability } from "@ngriffin_uk/polychat-schemas";

import type { OutputRecord } from "~/repositories/OutputRepository";

const RESTORABLE_LOCAL_CONTENT = new Set([
  "articles:analysis",
  "articles:report",
  "articles:summary",
  "notes:note",
  "strudel:strudel_pattern",
]);

export function getOutputRestoreCapability(
  output: Pick<OutputRecord, "capability_id" | "kind" | "status" | "storage_key">,
): OutputRestoreCapability {
  if (output.status === "pending") {
    return {
      supported: false,
      reason: "Wait for this output to finish before restoring an earlier local result.",
      fields: [],
    };
  }

  if (output.storage_key) {
    return {
      supported: false,
      reason: "File-backed output history is review-only; restoring metadata cannot restore bytes.",
      fields: [],
    };
  }

  if (output.capability_id === "sandbox" || output.kind === "sandbox_artifact") {
    return {
      supported: false,
      reason:
        "Sandbox diffs are review-only; a local output restore cannot reverse repository work.",
      fields: [],
    };
  }

  if (RESTORABLE_LOCAL_CONTENT.has(`${output.capability_id}:${output.kind}`)) {
    return { supported: true, reason: null, fields: ["title", "content"] };
  }

  return {
    supported: false,
    reason:
      "This output type is review-only because a local restore could misrepresent external work.",
    fields: [],
  };
}
