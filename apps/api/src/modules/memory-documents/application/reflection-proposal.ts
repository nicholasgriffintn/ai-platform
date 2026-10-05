import {
  MEMORY_DOCUMENT_MAX_CONTENT,
  memoryReflectionProposalSchema,
  type MemoryReflectionProposal,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

export interface MemoryReflectionSource {
  id: string;
  text: string;
}

export function applyMemoryReflectionProposal(
  base: string,
  input: MemoryReflectionProposal,
  sources: readonly MemoryReflectionSource[],
) {
  const proposal = memoryReflectionProposalSchema.parse(input);
  let content = base;

  for (const edit of proposal.edits) {
    if (redactSensitiveTokens(edit.after) !== edit.after || edit.after.includes("[redacted]")) {
      throw new AssistantError(
        "Memory corrections cannot retain credentials",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    for (const evidence of edit.evidence) {
      const source = sources.find((item) => item.id === evidence.messageId);

      if (!source?.text.includes(evidence.quote)) {
        throw new AssistantError(
          "Memory correction cites an unavailable source",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }
    }

    if (!edit.before) {
      if (edit.after.trim() && !content.includes(edit.after.trim())) {
        content = `${content.trimEnd()}\n${edit.after.trim()}`.trim();
      }

      continue;
    }

    const index = content.indexOf(edit.before);

    if (index < 0 || content.indexOf(edit.before, index + 1) >= 0) {
      throw new AssistantError(
        "Memory correction does not identify a unique passage",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    content = `${content.slice(0, index)}${edit.after}${content.slice(index + edit.before.length)}`;
  }

  if (content.length > MEMORY_DOCUMENT_MAX_CONTENT) {
    throw new AssistantError(
      "Corrected memory exceeds the document limit",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return content;
}
