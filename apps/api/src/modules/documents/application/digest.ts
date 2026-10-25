import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  sourceContentSummaryDraftSchema,
  type SourceContentSummaryDraft,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { chunkText } from "@ngriffin_uk/polychat-utility-server/embeddings";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import { KVCache } from "~/infrastructure/cache";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/documents/digest" });

export const DOCUMENT_DIGEST_CHUNK_CHARS = 50_000;
const SECTION_CONCURRENCY = 4;
const DIGEST_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

const sectionSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
});

const documentDigestSchema = z.object({
  summary: sourceContentSummaryDraftSchema,
  sections: z.array(z.union([sectionSchema, z.null()])),
});

export type DocumentDigestSection = z.infer<typeof sectionSchema>;
export type DocumentDigest = z.infer<typeof documentDigestSchema>;

interface DigestRequest {
  env: IEnv;
  user: IUser;
  markdown: string;
}

type DigestModel = Awaited<ReturnType<typeof getAuxiliaryModel>>;

async function summariseSection(
  { env, user }: Omit<DigestRequest, "markdown">,
  target: DigestModel,
  excerpt: string,
): Promise<DocumentDigestSection | null> {
  try {
    const { object } = await ai.generateObject({
      env,
      user,
      model: target.model,
      provider: target.provider,
      reasoning_effort: target.effort,
      disable_functions: true,
      name: "document_section",
      schema: sectionSchema,
      system: getPromptText("document/digest/section"),
      prompt: excerpt,
    });

    return object;
  } catch (error) {
    logger.warn("Document digest section failed", { error: getErrorMessage(error) });

    return null;
  }
}

async function summariseWhole(
  { env, user }: Omit<DigestRequest, "markdown">,
  target: DigestModel,
  material: string,
): Promise<SourceContentSummaryDraft> {
  const { object } = await ai.generateObject({
    env,
    user,
    model: target.model,
    provider: target.provider,
    reasoning_effort: target.effort,
    disable_functions: true,
    name: "document_summary",
    schema: sourceContentSummaryDraftSchema,
    system: getPromptText("document/digest/summary"),
    prompt: material,
  });

  return object;
}

async function buildDigest({ env, user, markdown }: DigestRequest): Promise<DocumentDigest> {
  const target = await getAuxiliaryModel(env, user);
  const excerpts = chunkText(markdown, DOCUMENT_DIGEST_CHUNK_CHARS);

  if (excerpts.length <= 1) {
    return { summary: await summariseWhole({ env, user }, target, markdown), sections: [] };
  }

  const sections = await mapWithConcurrency(excerpts, SECTION_CONCURRENCY, (excerpt) =>
    summariseSection({ env, user }, target, excerpt),
  );
  const completed = sections.filter((section) => section !== null);

  if (completed.length === 0) {
    throw new AssistantError(
      "The document is too long for this model and could not be summarised",
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }

  const summary = await summariseWhole(
    { env, user },
    target,
    completed.map((section) => `## ${section.title}\n\n${section.summary}`).join("\n\n"),
  );

  return { summary, sections };
}

export async function digestDocument(request: DigestRequest): Promise<DocumentDigest> {
  const cache = request.env.CACHE ? new KVCache(request.env.CACHE, DIGEST_CACHE_TTL_SECONDS) : null;
  const key = KVCache.createKey(
    "document-digest",
    String(request.user.id ?? "anonymous"),
    await sha256Hex(request.markdown),
  );
  const cached = documentDigestSchema.safeParse(await cache?.get<unknown>(key));

  if (cached.success) {
    return cached.data;
  }

  const digest = await buildDigest(request);

  if (digest.sections.every((section) => section !== null)) {
    await cache?.set(key, digest);
  }

  return digest;
}

export function formatDocumentDigest(name: string | undefined, digest: DocumentDigest): string {
  const missing = digest.sections.filter((section) => section === null).length;
  const sections = digest.sections
    .map((section, index) =>
      section
        ? `### ${index + 1}. ${section.title}\n\n${section.summary}`
        : `### ${index + 1}. (not summarised)\n\nThis part of the document could not be summarised.`,
    )
    .join("\n\n");
  const notice = [
    `This is a digest of ${name ? `"${name}"` : "an attached document"}, which is too long to include in full for this model.`,
    digest.sections.length > 0
      ? `It was split into ${digest.sections.length} parts and each part summarised.`
      : "",
    missing > 0 ? `${missing} part(s) could not be summarised and are missing.` : "",
    "Say when an answer needs detail the digest does not contain.",
  ]
    .filter(Boolean)
    .join(" ");
  const keyPoints = digest.summary.keyPoints.map((point) => `- ${point}`).join("\n");

  return [
    notice,
    `## Summary\n\n${digest.summary.summary}`,
    keyPoints ? `## Key points\n\n${keyPoints}` : "",
    sections ? `## Sections\n\n${sections}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
