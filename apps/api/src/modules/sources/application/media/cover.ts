import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import type { CreateSourceCoverInput, Source } from "@ngriffin_uk/polychat-schemas";
import { readStreamBytes } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { readSourceRecordMedia, updateSourceRecord } from "./metadata";

const COVER_MODEL = "@cf/bytedance/stable-diffusion-xl-lightning";
const COVER_MIME_TYPE = "image/png";

function describeCover(source: SourceRecord, prompt?: string): string {
  const summary = readSourceRecordMedia(source).notes?.summary;
  const subject = prompt || summary || source.title;

  return `Square cover artwork for an episode titled "${source.title}". ${subject}. Bold, simple composition with no text.`;
}

export async function storeSourceCover(
  context: ServiceContext,
  source: SourceRecord,
  prompt?: string,
): Promise<SourceRecord> {
  const user = context.requireUser();
  const image = await context.env.AI.run(
    COVER_MODEL,
    { prompt: describeCover(source, prompt) },
    {
      gateway: {
        id: resolveAiGatewayId(),
        skipCache: false,
        cacheTtl: 3360,
        metadata: { email: user.email },
      },
    },
  );

  if (!(image instanceof ReadableStream)) {
    throw new AssistantError("Cover image was not generated", ErrorType.PROVIDER_ERROR);
  }

  const key = `sources/${source.id}/cover.png`;

  await StorageService.forPrivateAssets(context).uploadObject(key, await readStreamBytes(image), {
    httpMetadata: { contentType: COVER_MIME_TYPE },
  });

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
