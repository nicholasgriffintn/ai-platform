import {
  deckOutputContentSchema,
  DECK_OUTPUT_KIND,
  DOCUMENT_OUTPUT_KIND,
  documentOutputContentSchema,
  sheetOutputContentSchema,
  SHEET_OUTPUT_KIND,
  type DeckOutputContent,
  type Output,
  type SheetOutputContent,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createOutput, formatOutput, getOutput, updateOutput } from "~/modules/outputs/application";
import { requireOutputAccess } from "~/modules/outputs/application/access";

type WorkOutputContent =
  | { kind: typeof DECK_OUTPUT_KIND; content: DeckOutputContent }
  | { kind: typeof SHEET_OUTPUT_KIND; content: SheetOutputContent };

export type ReadableWorkOutput =
  | { kind: typeof DOCUMENT_OUTPUT_KIND; output: Output; text: string }
  | { kind: typeof DECK_OUTPUT_KIND; output: Output; content: DeckOutputContent; text: string }
  | { kind: typeof SHEET_OUTPUT_KIND; output: Output; content: SheetOutputContent; text: string };

function requireScope(output: Output, projectId: string | null | undefined) {
  if (projectId !== undefined && output.projectId !== projectId) {
    throw new AssistantError("That file is outside this scope", ErrorType.FORBIDDEN, 403);
  }
}

export async function writeWorkOutput(
  context: ServiceContext,
  userId: number,
  input: WorkOutputContent & {
    title: string;
    capabilityId: string;
    outputId?: string;
    expectedRevision?: number;
    projectId?: string;
    conversationId?: string;
  },
): Promise<Output> {
  const title = sanitiseInput(input.title);

  if (!title) {
    throw new AssistantError("A file needs a title", ErrorType.PARAMS_ERROR, 400);
  }

  if (!input.outputId) {
    return createOutput(context, userId, {
      capabilityId: input.capabilityId,
      kind: input.kind,
      title,
      status: "ready",
      content: input.content,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    });
  }

  const existing = formatOutput(await requireOutputAccess(context, userId, input.outputId, true));

  requireScope(existing, input.projectId ?? null);

  if (existing.kind !== input.kind) {
    throw new AssistantError(`That file is not a ${input.kind}`, ErrorType.PARAMS_ERROR, 400);
  }

  if (input.expectedRevision === undefined) {
    throw new AssistantError(
      "Pass the revision you read before editing this file",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (existing.revision !== input.expectedRevision) {
    throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
  }

  return updateOutput(context, userId, existing.id, {
    title,
    content: input.content,
    expectedRevision: existing.revision,
  });
}

export async function readWorkOutput(
  context: ServiceContext,
  userId: number,
  outputId: string,
  projectId?: string | null,
): Promise<ReadableWorkOutput> {
  const output = await getOutput(context, userId, outputId);

  requireScope(output, projectId);

  if (output.kind === DOCUMENT_OUTPUT_KIND) {
    const document = documentOutputContentSchema.safeParse(output.content);

    if (document.success) {
      return { kind: DOCUMENT_OUTPUT_KIND, output, text: document.data.body };
    }
  }

  if (output.kind === DECK_OUTPUT_KIND) {
    const deck = deckOutputContentSchema.safeParse(output.content);

    if (deck.success) {
      return {
        kind: DECK_OUTPUT_KIND,
        output,
        content: deck.data,
        text: JSON.stringify({ slides: deck.data.slides }, null, 2),
      };
    }
  }

  if (output.kind === SHEET_OUTPUT_KIND) {
    const sheet = sheetOutputContentSchema.safeParse(output.content);

    if (sheet.success) {
      return {
        kind: SHEET_OUTPUT_KIND,
        output,
        content: sheet.data,
        text: JSON.stringify({ tables: sheet.data.tables }, null, 2),
      };
    }
  }

  throw new AssistantError(
    "That result is not a document, deck or sheet",
    ErrorType.PARAMS_ERROR,
    400,
  );
}
