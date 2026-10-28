import { isDocumentOcrModel } from "@ngriffin_uk/polychat-ai-models";
import { requireOcrAccess } from "@ngriffin_uk/polychat-ai-providers";
import type { OcrExtractionResult } from "@ngriffin_uk/polychat-ai-providers";
import { getModelDisplayName, ocrSchema, type OcrRequest } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getOcrProvider,
  resolveOcrProviderName,
} from "~/infrastructure/providers/capabilities/ocr";
import { providerHost } from "~/infrastructure/providers/host";
import { findModelConfig, requireSystemModel } from "~/modules/models/application/resolve";
import { requireConversationScope } from "~/modules/outputs/application/access";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { recordProjectAudit } from "~/modules/workspaces/application/audit";

import { resolveOcrInput } from "./input";
import { readImageWithVisionModel } from "./vision";

export async function performOcr(params: {
  context: ServiceContext;
  userId: number;
  request: OcrRequest;
  projectId?: string;
  conversationId?: string;
}): Promise<OcrExtractionResult> {
  const request = ocrSchema.parse(params.request);

  if (params.projectId) {
    await requireProjectAccess(params.context, params.projectId);
  }

  if (params.conversationId) {
    await requireConversationScope(
      params.context,
      params.userId,
      params.conversationId,
      params.projectId,
    );
  }

  const resolvedInput = await resolveOcrInput({
    context: params.context,
    userId: params.userId,
    projectId: params.projectId,
    input: request.document,
  });
  const selected = request.model
    ? { model: request.model, provider: request.provider }
    : await requireSystemModel(params.context.env, params.context.user ?? undefined, "ocr");
  const providerName = await resolveOcrProviderName({
    env: params.context.env,
    model: selected.model,
    provider: selected.provider,
  });

  await requireOcrAccess(providerHost, {
    env: params.context.env,
    user: params.context.user ?? undefined,
    providerName,
  });
  const config = await findModelConfig(selected.model, params.context.env, selected.provider);
  const { document: _document, ...options } = request;
  const result =
    config && !isDocumentOcrModel(config)
      ? await readImageWithVisionModel(params.context, {
          model: {
            model: config.matchingModel,
            provider: config.provider,
            name: getModelDisplayName(config),
          },
          document: resolvedInput.document,
          outputFormat: request.output_format,
          projectId: params.projectId,
          conversationId: params.conversationId,
          parentOutputId: resolvedInput.parentOutputId,
        })
      : await getOcrProvider(providerName, {
          env: params.context.env,
          user: params.context.user ?? undefined,
        }).extractText({
          ...options,
          model: selected.model,
          id: generateId(),
          env: params.context.env,
          user: params.context.user ?? undefined,
          provider: providerName,
          document: resolvedInput.document,
          projectId: params.projectId,
          conversationId: params.conversationId,
          parentOutputId: resolvedInput.parentOutputId,
        });

  if (resolvedInput.sourceId) {
    await params.context.repositories
      .get(OutputRepository)
      .attachSources(result.outputId, [resolvedInput.sourceId]);
  }

  if (params.projectId) {
    await recordProjectAudit(params.context, params.projectId, {
      actorUserId: params.userId,
      action: "output.created",
      targetType: "output",
      targetId: result.outputId,
      metadata: { capabilityId: "ocr", kind: "ocr_output" },
    });
  }

  return result;
}

export { resolveOcrInput } from "./input";
