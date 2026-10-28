import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  buildOcrMarkdown,
  normaliseOcrResponse,
  persistOcrOutput,
  type OcrApiResponse,
  type OcrDocument,
  type OcrExtractionResult,
  type OcrOutputFormat,
} from "@ngriffin_uk/polychat-ai-providers";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { providerHost } from "~/infrastructure/providers/host";
import type { ResolvedSystemModel } from "~/modules/models/application/resolve";

const MAX_INLINE_OCR_TEXT_LENGTH = 20_000;

export interface VisionOcrRequest {
  model: Pick<ResolvedSystemModel, "model" | "provider" | "name">;
  document: OcrDocument;
  outputFormat?: OcrOutputFormat;
  projectId?: string;
  conversationId?: string;
  parentOutputId?: string;
}

export async function readImageWithVisionModel(
  context: ServiceContext,
  request: VisionOcrRequest,
): Promise<OcrExtractionResult> {
  const user = context.requireUser();

  if (request.document.type !== "image_url") {
    throw new AssistantError(
      `${request.model.name} reads images only. Choose a dedicated document model in your model choices to read PDFs.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const markdown = await ai.generateText({
    env: context.env,
    user,
    model: request.model.model,
    provider: request.model.provider,
    disable_functions: true,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: getPromptText("apps/documents/read-image") },
          { type: "image_url", image_url: { url: request.document.image_url } },
        ],
      },
    ],
  });
  const response: OcrApiResponse = {
    model: request.model.model,
    pages: [{ index: 0, markdown, images: [], tables: [], hyperlinks: [] }],
    usage_info: { pages_processed: markdown ? 1 : 0 },
  };
  const storage = providerHost.storage.forContext({ env: context.env, user });

  if (!storage) {
    throw new AssistantError(
      "Storage is not configured for OCR output",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const asset = await persistOcrOutput({
    requestId: generateId(),
    response,
    outputFormat: request.outputFormat ?? "markdown",
    storage,
    ownerUserId: user.id,
    projectId: request.projectId,
    conversationId: request.conversationId,
    parentOutputId: request.parentOutputId,
  });

  return {
    model: request.model.model,
    ...asset,
    extractedText: buildOcrMarkdown(response).slice(0, MAX_INLINE_OCR_TEXT_LENGTH),
    response: normaliseOcrResponse(response),
  };
}
