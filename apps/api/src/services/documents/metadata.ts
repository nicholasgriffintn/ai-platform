import { buildDocumentMetadataPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  deriveDocumentStatistics,
  documentMetadataSchema,
  type DocumentMetadata,
} from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/lib/ai";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/services/models/resolve";
import type { IUser } from "~/types";

const logger = getLogger({ prefix: "services/documents/metadata" });

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
    const { object } = await ai.generateObject({
      env: context.env,
      user,
      model,
      provider,
      system: buildDocumentMetadataPrompt(),
      prompt: `Title: ${title}\n\n${body}`,
      reasoning: { effort: "none" },
      schema: documentMetadataSchema,
      name: "document_metadata",
    });

    return { ...existing, ...object, ...statistics };
  } catch (error) {
    logger.error("Could not describe a document", { error });

    return { ...existing, ...statistics };
  }
}
