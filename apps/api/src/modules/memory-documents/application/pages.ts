import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";
import type {
  MemoryDocumentPage,
  MemoryEvidence,
  ReadMemoryDocumentInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sliceTextAtCodePointBoundaries } from "@ngriffin_uk/polychat-utility-server/strings";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { readMemoryDocumentDetails } from "~/modules/memory-documents/domain/details";
import {
  describeMemoryEvidence,
  readMemoryEvidence,
} from "~/modules/memory-documents/domain/evidence";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import type { MemoryScope } from "~/types";

import { requireRunMemoryDocument } from "./run-access";

const EVIDENCE_REVISIONS = 10;

export function memoryDocumentPage(
  document: MemoryDocumentRow,
  offset: number,
  maxCharacters = 4000,
  evidence: readonly MemoryEvidence[] = [],
): MemoryDocumentPage {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > document.content.length ||
    !Number.isInteger(maxCharacters) ||
    maxCharacters < 1
  ) {
    throw new AssistantError("The page starts beyond this document", ErrorType.PARAMS_ERROR, 400);
  }

  let page = sliceTextAtCodePointBoundaries(
    document.content,
    offset,
    Math.min(maxCharacters, 4000),
  );

  while (estimateTextTokens(page.content) > 2000) {
    page = sliceTextAtCodePointBoundaries(
      document.content,
      page.start,
      Math.max(1, Math.floor(page.content.length * 0.75)),
    );
  }

  return {
    documentId: document.id,
    revision: document.revision,
    content: page.content,
    offset: page.start,
    nextOffset: page.end < document.content.length ? page.end : null,
    totalCharacters: document.content.length,
    evidence: page.end < document.content.length ? [] : [...evidence],
  };
}

export function memoryDocumentPageText(page: MemoryDocumentPage): string {
  if (page.evidence.length === 0) {
    return page.content;
  }

  return `${page.content}\n\n## Where this came from\n\n${page.evidence
    .map((evidence) => `- ${describeMemoryEvidence(evidence)}`)
    .join("\n")}`;
}

export async function readRunMemoryDocument(
  context: ServiceContext,
  scope: MemoryScope,
  input: ReadMemoryDocumentInput,
) {
  const { document } = await requireRunMemoryDocument(context, scope, input.documentId);

  if (document.revision !== input.revision) {
    throw new AssistantError(
      `This memory changed to revision ${document.revision}. Restart reading at offset 0 using that revision.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const evidence = (
    await context.repositories
      .get(MemoryDocumentRepository)
      .listRecentEvidence(document.id, EVIDENCE_REVISIONS)
  ).flatMap(readMemoryEvidence);

  return memoryDocumentPage(document, input.offset, input.maxCharacters, evidence);
}

export function memoryPassageResult(
  document: MemoryDocumentRow,
  passage: { content: string; score: number },
) {
  return {
    id: document.id,
    text: [document.name, readMemoryDocumentDetails(document).description, passage.content]
      .filter(Boolean)
      .join("\n"),
    score: passage.score,
    metadata: { name: document.name, revision: document.revision, documentId: document.id },
  };
}
