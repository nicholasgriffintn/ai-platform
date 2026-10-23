import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  formatTranscriptText,
  sourceNotesSchema,
  type Source,
  type SummariseSourceInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";

import { readSourceRecordMedia, updateSourceRecord } from "./metadata";

const MAX_NOTES_INPUT_CHARACTERS = 120_000;

export async function summariseSource(
  context: ServiceContext,
  sourceId: string,
  input: SummariseSourceInput,
): Promise<Source> {
  const user = context.requireUser();
  const source = await requireSourceAccess(context, user.id, sourceId, true);
  const media = readSourceRecordMedia(source);
  const transcript = media.transcript?.status === "ready" ? media.transcript : null;
  const speakers = { ...transcript?.speakers, ...input.speakers };
  const text = transcript
    ? formatTranscriptText({ ...transcript, speakers })
    : (source.content ?? "").trim();

  if (!text) {
    throw new AssistantError(
      "Transcribe this source before writing notes",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { model, provider, effort } = await getAuxiliaryModel(context.env, user);
  const { object: notes } = await ai.generateObject({
    env: context.env,
    user,
    model,
    provider,
    reasoning_effort: effort,
    disable_functions: true,
    name: "source_notes",
    schema: sourceNotesSchema,
    system: getPromptText("sources/media/notes"),
    prompt: text.slice(0, MAX_NOTES_INPUT_CHARACTERS),
  });

  return formatSource(
    await updateSourceRecord(context, source, {
      ...(transcript ? { content: text } : {}),
      media: {
        notes,
        ...(transcript ? { transcript: { ...transcript, speakers } } : {}),
      },
    }),
  );
}
