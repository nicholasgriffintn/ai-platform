import {
  deriveDocumentStatistics,
  documentMetadataSchema,
  type DocumentMetadata,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/providers/models";
import type { IUser } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/documents/metadata" });

const METADATA_PROMPT = `Read the document and describe it as JSON. Include:
- tags: up to eight short labels somebody would search for
- summary: one or two sentences, no preamble
- keyTopics: up to five subjects the document actually covers
- contentType: one of "text", "list", "outline" or "mixed"
- sentiment: one of "positive", "neutral" or "negative", describing its tone

Return only the JSON object, with no markdown fence around it.`;

function readProviderText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (!result || typeof result !== "object") {
    return "{}";
  }

  const record = result as { response?: unknown; choices?: unknown };

  if (typeof record.response === "string") {
    return record.response;
  }

  if (Array.isArray(record.choices)) {
    const message = (record.choices[0] as { message?: { content?: unknown } } | undefined)?.message;

    if (typeof message?.content === "string") {
      return message.content;
    }
  }

  return "{}";
}

export async function describeDocument({
  context,
  user,
  title,
  body,
  existing,
}: {
  context: ServiceContext;
  user: IUser;
  title: string;
  body: string;
  existing?: DocumentMetadata;
}): Promise<DocumentMetadata> {
  const statistics = deriveDocumentStatistics(body);

  try {
    const { model, provider } = await getAuxiliaryModel(context.env, user);
    const chat = getChatProvider(provider, { env: context.env, user });
    const result = await chat.getResponse(
      {
        model,
        env: context.env,
        context,
        messages: [
          { role: "system", content: METADATA_PROMPT },
          { role: "user", content: `Title: ${title}\n\n${body}` },
        ],
        reasoning: { effort: "none" },
      },
      user.id,
    );
    const parsed = documentMetadataSchema.safeParse(
      safeParseJson<Record<string, unknown>>(readProviderText(result)) ?? {},
    );

    return { ...existing, ...(parsed.success ? parsed.data : {}), ...statistics };
  } catch (error) {
    logger.error("Could not describe a document", { error });

    return { ...existing, ...statistics };
  }
}
