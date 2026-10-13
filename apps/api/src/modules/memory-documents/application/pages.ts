import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";
import type { MemoryDocumentPage, ReadMemoryDocumentInput } from "@ngriffin_uk/polychat-schemas";
import { escapeRegExp } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sliceTextAtCodePointBoundaries } from "@ngriffin_uk/polychat-utility-server/strings";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import type { MemoryScope } from "~/types";

import { requireRunMemoryDocument } from "./run-access";

export function memoryDocumentPage(
  document: MemoryDocumentRow,
  offset: number,
  maxCharacters = 4000,
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
  };
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

  return memoryDocumentPage(document, input.offset, input.maxCharacters);
}

export function memorySearchPassage(document: MemoryDocumentRow, query: string) {
  const match = document.content.search(new RegExp(escapeRegExp(query), "iu"));
  const page = memoryDocumentPage(document, Math.max(0, match - 300), 1500);

  return {
    id: document.id,
    text: `${document.name}\n${page.content}`,
    score: 1,
    metadata: {
      name: document.name,
      revision: document.revision,
      offset: page.offset,
      nextOffset: page.nextOffset,
      totalCharacters: page.totalCharacters,
      documentId: document.id,
    },
  };
}
