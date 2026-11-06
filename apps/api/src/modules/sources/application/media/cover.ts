import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import type { CreateSourceCoverInput, Source } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { storeDrawnImage, TEXTLESS_PICTURE } from "~/modules/generate/application/stored-image";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { withProjectFunding } from "~/modules/usage/application/workspace-funding";

import { readSourceRecordMedia, updateSourceRecord } from "./metadata";

const COVER_MIME_TYPE = "image/png";
const COVER_SIZE = 1024;

const coverPictureSchema = z.object({ picture: z.string().min(1) });

async function describeCover(
  context: ServiceContext,
  source: SourceRecord,
  prompt?: string,
): Promise<string> {
  const subject = prompt || readSourceRecordMedia(source).notes?.summary || source.title;
  const { picture } = await generateSystemObject(context, {
    role: "housekeeping",
    name: "source_cover",
    requiresReasoning: false,
    schema: coverPictureSchema,
    system: getPromptText("sources/media/cover"),
    material: `Title: ${source.title}\n\nAbout: ${subject}`,
  });

  return `Square cover artwork. ${picture} Bold, simple composition. ${TEXTLESS_PICTURE}`;
}

export async function storeSourceCover(
  context: ServiceContext,
  source: SourceRecord,
  prompt?: string,
): Promise<SourceRecord> {
  const coverId = generateId();
  const key = `sources/${source.id}/cover-${coverId}.png`;
  const stored = await withProjectFunding(
    context.repositories,
    { projectId: source.project_id },
    async () =>
      storeDrawnImage(context, key, {
        completionId: `source-cover-${coverId}`,
        prompt: await describeCover(context, source, prompt),
        aspectRatio: "1:1",
        width: COVER_SIZE,
        height: COVER_SIZE,
      }),
  );

  if (!stored) {
    throw new AssistantError("Cover image was not generated", ErrorType.PROVIDER_ERROR);
  }

  return updateSourceRecord(context, source, {
    media: { cover: { key, mimeType: COVER_MIME_TYPE } },
  });
}

export async function createSourceCover(
  context: ServiceContext,
  sourceId: string,
  input: CreateSourceCoverInput,
): Promise<Source> {
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId, true);

  return formatSource(await storeSourceCover(context, source, input.prompt));
}

export async function readSourceCoverObject(context: ServiceContext, source: SourceRecord) {
  const cover = readSourceRecordMedia(source).cover;
  const object = cover
    ? await StorageService.forPrivateAssets(context).getObjectBody(cover.key)
    : null;

  if (!cover || !object) {
    throw new AssistantError("Cover not found", ErrorType.NOT_FOUND, 404);
  }

  return new Response(await object.arrayBuffer(), {
    headers: {
      "Content-Type": cover.mimeType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
