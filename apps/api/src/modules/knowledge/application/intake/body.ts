import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  KNOWLEDGE_BODY_PREVIEW_CHARACTERS,
  KNOWLEDGE_INLINE_BODY_CHARACTERS,
  type KnowledgeBody,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { knowledgeBodyBelongsTo, readKnowledgeBody } from "~/modules/knowledge/domain/envelope";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "knowledge/body" });

export interface PreparedKnowledgeBody {
  content: string;
  body: KnowledgeBody | null;
  staleKey: string | null;
  changed: boolean;
}

interface StoredText {
  id: string;
  content: string | null;
  metadata: string | Record<string, unknown> | null;
}

function knowledgeBodyKey(sourceId: string, hash: string): string {
  return `knowledge/bodies/${sourceId}/${hash.slice(0, 40)}.txt`;
}

export async function prepareKnowledgeBody(
  env: Pick<IEnv, "PRIVATE_ASSETS_BUCKET">,
  sourceId: string,
  content: string,
  previous: KnowledgeBody | null,
): Promise<PreparedKnowledgeBody> {
  if (content.length <= KNOWLEDGE_INLINE_BODY_CHARACTERS || !env.PRIVATE_ASSETS_BUCKET) {
    return { content, body: null, staleKey: previous?.key ?? null, changed: previous !== null };
  }

  const hash = await sha256Hex(content);
  const key = knowledgeBodyKey(sourceId, hash);

  if (previous?.hash !== hash) {
    await env.PRIVATE_ASSETS_BUCKET.put(key, content, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });
  }

  return {
    content: content.slice(0, KNOWLEDGE_BODY_PREVIEW_CHARACTERS),
    body: { key, characters: content.length, hash },
    staleKey: previous && previous.key !== key ? previous.key : null,
    changed: previous?.hash !== hash,
  };
}

export async function readKnowledgeText(
  context: Pick<ServiceContext, "env">,
  source: StoredText,
): Promise<string> {
  const metadata =
    typeof source.metadata === "string" || source.metadata === null
      ? parseJsonRecord(source.metadata)
      : source.metadata;
  const body = readKnowledgeBody(metadata);

  if (!body || !knowledgeBodyBelongsTo(body, source.id) || !context.env.PRIVATE_ASSETS_BUCKET) {
    return source.content ?? "";
  }

  const object = await context.env.PRIVATE_ASSETS_BUCKET.get(body.key);

  if (!object) {
    logger.warn("A knowledge body is missing from storage", { key: body.key });

    return source.content ?? "";
  }

  return object.text();
}

export async function deleteKnowledgeBodies(
  context: Pick<ServiceContext, "env">,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0 || !context.env.PRIVATE_ASSETS_BUCKET) {
    return;
  }

  try {
    await context.env.PRIVATE_ASSETS_BUCKET.delete([...keys]);
  } catch (error) {
    logger.warn("Knowledge bodies could not be removed", {
      error_message: getErrorMessage(error),
    });
  }
}

export async function withKnowledgeText<TSource extends StoredText>(
  context: Pick<ServiceContext, "env">,
  sources: readonly TSource[],
): Promise<TSource[]> {
  return Promise.all(
    sources.map(async (source) => {
      const metadata =
        typeof source.metadata === "string" || source.metadata === null
          ? parseJsonRecord(source.metadata)
          : source.metadata;

      return readKnowledgeBody(metadata)
        ? { ...source, content: await readKnowledgeText(context, source) }
        : source;
    }),
  );
}
