import z from "zod/v4";

import type { ChatRunStatus } from "./chat-runs";
import { isTerminalChatRunStatus } from "./chat-runs";
import {
  getModelDisplayName,
  getModelInputModalities,
  isImageGenerationOutputModel,
} from "./model-selection";
import type { ModelConfigItem } from "./models";

export const modelAttachmentTypeSchema = z.enum([
  "image",
  "document",
  "audio",
  "markdown_document",
  "artifact_selection",
]);

export const modelContinuityStateSchema = z.enum([
  "next_run",
  "new_conversation_required",
  "blocked",
]);

export const modelContinuityDecisionSchema = z.object({
  state: modelContinuityStateSchema,
  reason: z.string().min(1),
  preserves: z.array(z.enum(["conversation_history", "compatible_attachments"])),
  doesNotCarry: z.array(
    z.enum(["active_run", "pending_interaction", "model_response_settings", "attachments"]),
  ),
  unsupportedAttachments: z.array(modelAttachmentTypeSchema).default([]),
});

export type ModelAttachmentType = z.infer<typeof modelAttachmentTypeSchema>;
export type ModelContinuityDecision = z.infer<typeof modelContinuityDecisionSchema>;

export interface ModelContinuityInput {
  activeRunStatus?: ChatRunStatus | null;
  attachmentTypes?: readonly ModelAttachmentType[];
  hasConversationHistory: boolean;
  nextModel: ModelConfigItem;
}

function supportsAttachment(model: ModelConfigItem, type: ModelAttachmentType): boolean {
  const inputs = getModelInputModalities(model);

  if (type === "image") {
    return Boolean(model.multimodal) || inputs.includes("image");
  }

  if (type === "audio") {
    return Boolean(model.supportsAudio) || inputs.includes("audio");
  }

  if (type === "document") {
    return Boolean(model.supportsDocuments || model.supportsAttachments) || inputs.includes("pdf");
  }

  return inputs.includes("text");
}

export function evaluateModelContinuity({
  activeRunStatus,
  attachmentTypes = [],
  hasConversationHistory,
  nextModel,
}: ModelContinuityInput): ModelContinuityDecision {
  const modelName = getModelDisplayName(nextModel);

  if (activeRunStatus && !isTerminalChatRunStatus(activeRunStatus)) {
    const pendingInteraction =
      activeRunStatus === "awaiting_approval" || activeRunStatus === "awaiting_input";

    return {
      state: "blocked",
      reason: pendingInteraction
        ? "Resolve or cancel the current approval or question before changing models. It belongs to the model run that requested it."
        : "Wait for or cancel the current model run before changing models.",
      preserves: ["conversation_history", "compatible_attachments"],
      doesNotCarry: pendingInteraction
        ? ["active_run", "pending_interaction", "model_response_settings"]
        : ["active_run", "model_response_settings"],
      unsupportedAttachments: [],
    };
  }

  const unsupportedAttachments = Array.from(new Set(attachmentTypes)).filter(
    (type) => !supportsAttachment(nextModel, type),
  );

  if (unsupportedAttachments.length > 0) {
    return {
      state: "blocked",
      reason: `${modelName} cannot use the attached ${unsupportedAttachments.join(", ")} content. Remove it or choose a compatible model.`,
      preserves: ["conversation_history"],
      doesNotCarry: ["model_response_settings", "attachments"],
      unsupportedAttachments,
    };
  }

  if (
    hasConversationHistory &&
    isImageGenerationOutputModel(nextModel) &&
    !nextModel.supportsImageEdits
  ) {
    return {
      state: "new_conversation_required",
      reason: `${modelName} only supports the first turn of a conversation. Start a new conversation to use it; this conversation's history will not carry across.`,
      preserves: [],
      doesNotCarry: ["model_response_settings", "active_run"],
      unsupportedAttachments: [],
    };
  }

  return {
    state: "next_run",
    reason: hasConversationHistory
      ? `The next message starts a new run with ${modelName}. Existing conversation history and compatible attachments remain; model-specific response settings reset.`
      : `The next message starts a run with ${modelName}; model-specific response settings reset.`,
    preserves: [
      ...(hasConversationHistory ? (["conversation_history"] as const) : []),
      ...(attachmentTypes.length > 0 ? (["compatible_attachments"] as const) : []),
    ],
    doesNotCarry: ["model_response_settings"],
    unsupportedAttachments: [],
  };
}
