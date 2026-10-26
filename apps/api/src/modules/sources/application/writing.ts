import type { GenerateNotesFromMediaInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatDocumentBody, generateDocumentFromMedia } from "~/modules/documents/application";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { requireSourceAccess } from "~/modules/sources/application/sources";

export async function formatSourceText(
  context: ServiceContext,
  sourceId: string,
  prompt?: string,
): Promise<{ content: string }> {
  const user = context.requireUser();
  const source = await requireSourceAccess(context, user.id, sourceId);

  return {
    content: await formatDocumentBody({
      context,
      user,
      body: await readKnowledgeText(context, source),
      prompt,
    }),
  };
}

export async function draftNotesFromMedia(
  context: ServiceContext,
  input: GenerateNotesFromMediaInput,
): Promise<{ content: string }> {
  const { content } = await generateDocumentFromMedia({
    context,
    user: context.requireUser(),
    url: input.url,
    outputs: input.outputs,
    documentType: input.noteType,
    extraPrompt: input.extraPrompt,
    timestamps: input.timestamps,
  });

  return { content };
}
