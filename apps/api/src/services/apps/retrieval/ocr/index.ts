import { requireOcrAccess } from "@ngriffin_uk/polychat-ai-providers";
import type { OcrExtractionResult } from "@ngriffin_uk/polychat-ai-providers";
import { ocrSchema, type OcrRequest } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getOcrProvider, resolveOcrProviderName } from "~/lib/providers/capabilities/ocr";
import { providerHost } from "~/lib/providers/host";
import { recordProjectAudit } from "~/services/audit";
import { requireConversationScope } from "~/services/outputs/access";
import { requireProjectAccess } from "~/services/workspaces/access";

import { resolveOcrInput } from "./input";

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

  const providerName = await resolveOcrProviderName({
    env: params.context.env,
    model: request.model,
    provider: request.provider,
  });

  await requireOcrAccess(providerHost, {
    env: params.context.env,
    user: params.context.user ?? undefined,
    providerName,
  });
  const resolvedInput = await resolveOcrInput({
    context: params.context,
    userId: params.userId,
    projectId: params.projectId,
    input: request.document,
  });
  const provider = getOcrProvider(providerName, {
    env: params.context.env,
    user: params.context.user ?? undefined,
  });
  const { document: _document, ...options } = request;
  const result = await provider.extractText({
    ...options,
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
    await params.context.repositories.outputs.attachSources(result.outputId, [
      resolvedInput.sourceId,
    ]);
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
