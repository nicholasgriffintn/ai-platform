import {
  DOCUMENT_OUTPUT_KIND,
  readDocumentBody,
  type DocumentCommentSubject,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { formatOutput, getOutput } from "~/modules/outputs/application";
import { requireOutputAccess } from "~/modules/outputs/application/access";
import { requireSourceAccess } from "~/modules/sources/application/sources";

export interface DiscussionSubject {
  subject: DocumentCommentSubject;
  title: string;
  revision: number;
  body: string;
  projectId: string | null;
  createdByUserId: number;
}

export async function requireDocument(
  context: ServiceContext,
  userId: number,
  outputId: string,
  mutate = false,
  projectId?: string | null,
) {
  const output = mutate
    ? formatOutput(await requireOutputAccess(context, userId, outputId, true))
    : await getOutput(context, userId, outputId);

  if (projectId !== undefined && output.projectId !== projectId) {
    throw new AssistantError("Document is outside this scope", ErrorType.FORBIDDEN, 403);
  }

  const body = readDocumentBody(output.content);

  if (output.kind !== DOCUMENT_OUTPUT_KIND || body === null) {
    throw new AssistantError("That result is not a document", ErrorType.PARAMS_ERROR, 400);
  }

  return { output, body };
}

export async function requireDiscussionSubject(
  context: ServiceContext,
  userId: number,
  subject: DocumentCommentSubject,
): Promise<DiscussionSubject> {
  if (subject.type === "output") {
    const { output, body } = await requireDocument(context, userId, subject.id);

    return {
      subject,
      title: output.title,
      revision: output.revision,
      body,
      projectId: output.projectId,
      createdByUserId: output.createdByUserId,
    };
  }

  const source = await requireSourceAccess(context, userId, subject.id);

  if (source.kind !== "text") {
    throw new AssistantError(
      "Only notes and other text take comments",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    subject,
    title: source.title,
    revision: source.revision,
    body: await readKnowledgeText(context, source),
    projectId: source.project_id,
    createdByUserId: source.created_by_user_id,
  };
}
