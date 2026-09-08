import {
  buildDocumentContent,
  DOCUMENT_OUTPUT_KIND,
  readDocumentBody,
  readDocumentMetadata,
  type DocumentMetadata,
  type Output,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { createOutput, getOutput, updateOutput } from "~/services/outputs";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { sanitiseInput } from "~/utils/sanitise";

import { formatDocumentBody } from "./format";
import { describeDocument } from "./metadata";

export { describeDocument } from "./metadata";
export { formatDocumentBody } from "./format";
export { generateDocumentFromMedia } from "./from-media";

export const DOCUMENT_DEFAULT_CAPABILITY_ID = "documents";

async function requireDocument(
  context: ServiceContext,
  userId: number,
  outputId: string,
): Promise<{ output: Output; body: string }> {
  const output = await getOutput(context, userId, outputId);
  const body = readDocumentBody(output.content);

  if (output.kind !== DOCUMENT_OUTPUT_KIND || body === null) {
    throw new AssistantError("That result is not a document", ErrorType.PARAMS_ERROR, 400);
  }

  return { output, body };
}

export async function writeDocument(
  context: ServiceContext,
  user: IUser,
  input: {
    title: string;
    body: string;
    outputId?: string;
    projectId?: string;
    conversationId?: string;
    capabilityId?: string;
    sourceType?: DocumentMetadata["sourceType"];
    describe?: boolean;
  },
): Promise<Output> {
  const title = sanitiseInput(input.title);
  const body = sanitiseInput(input.body);

  if (!title || !body) {
    throw new AssistantError("A document needs a title and a body", ErrorType.PARAMS_ERROR, 400);
  }

  const existing = input.outputId ? await requireDocument(context, user.id, input.outputId) : null;
  const carried: DocumentMetadata = {
    ...(existing ? (readDocumentMetadata(existing.output.content) ?? {}) : {}),
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
  };
  const metadata =
    input.describe === false
      ? carried
      : await describeDocument({ context, user, title, body, existing: carried });
  const content = buildDocumentContent(body, metadata);

  if (existing) {
    return updateOutput(context, user.id, existing.output.id, {
      title,
      content,
      expectedRevision: existing.output.revision,
    });
  }

  return createOutput(context, user.id, {
    capabilityId: input.capabilityId ?? DOCUMENT_DEFAULT_CAPABILITY_ID,
    kind: DOCUMENT_OUTPUT_KIND,
    title,
    status: "ready",
    content,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
  });
}

export async function formatDocument(
  context: ServiceContext,
  user: IUser,
  outputId: string,
  prompt?: string,
): Promise<{ body: string }> {
  const { body } = await requireDocument(context, user.id, outputId);

  return { body: await formatDocumentBody({ context, user, body, prompt }) };
}

export async function redescribeDocument(
  context: ServiceContext,
  user: IUser,
  outputId: string,
  expectedRevision?: number,
): Promise<{ metadata: DocumentMetadata }> {
  const { output, body } = await requireDocument(context, user.id, outputId);

  if (expectedRevision !== undefined && expectedRevision !== output.revision) {
    throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
  }

  const metadata = await describeDocument({
    context,
    user,
    title: output.title,
    body,
    existing: readDocumentMetadata(output.content) ?? undefined,
  });

  await updateOutput(context, user.id, outputId, {
    content: buildDocumentContent(body, metadata),
    expectedRevision: output.revision,
  });

  return { metadata };
}
