import { APP_DESCRIPTION, APP_NAME } from "~/constants/app";
import { hasProviderReasoningOptions } from "~/lib/providers/models/reasoning";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import type { IBody } from "~/types";
import { getEffectiveMaxTokens } from "~/utils/parameters";
import { PromptBuilder } from "../builder";

export interface PromptModelMetadata {
	modelId?: string;
	modelConfig?: ModelConfigItem;
}

interface AssistantMetadataSectionOptions extends PromptModelMetadata {
	request: Partial<IBody>;
	format?: "full" | "compact";
}

function asList(values?: string[]): string {
	return values && values.length > 0 ? values.join(", ") : "unspecified";
}

export function buildAssistantMetadataSection({
	request,
	modelId,
	modelConfig,
	format = "full",
}: AssistantMetadataSectionOptions): string {
	const activeModelId = modelId || request.model || modelConfig?.matchingModel || "unknown";
	const requestedMaxTokens =
		request.max_tokens ?? request.max_completion_tokens ?? request.max_output_tokens;
	const effectiveMaxOutputTokens = getEffectiveMaxTokens(
		typeof requestedMaxTokens === "number" ? requestedMaxTokens : undefined,
		modelConfig?.maxTokens,
	);

	const builder = new PromptBuilder("<assistant_identity>")
		.addLine()
		.addLine(`<name>${APP_NAME}</name>`)
		.addLine(`<description>${APP_DESCRIPTION}</description>`);
	builder.addLine("</assistant_identity>").addLine();

	const enabledCapabilities = [
		modelConfig?.supportsToolCalls ? "tool_calls" : null,
		hasProviderReasoningOptions(modelConfig) ? "reasoning" : null,
		modelConfig?.supportsDocuments ? "documents" : null,
		modelConfig?.supportsSearchGrounding ? "search_grounding" : null,
		modelConfig?.supportsCodeExecution ? "code_execution" : null,
		modelConfig?.supportsAttachments ? "attachments" : null,
		modelConfig?.supportsResponseFormat ? "response_format" : null,
	].filter(Boolean);

	if (format === "compact") {
		builder
			.addLine("<model_card>")
			.addLine(`<model_id>${activeModelId}</model_id>`)
			.addLine(`<provider>${modelConfig?.provider ?? "unknown"}</provider>`)
			.addLine(`<context_window>${modelConfig?.contextWindow ?? "unspecified"}</context_window>`)
			.addLine(
				`<effective_max_output_tokens>${effectiveMaxOutputTokens}</effective_max_output_tokens>`,
			)
			.addLine(
				`<supported_capabilities>${
					enabledCapabilities.length > 0 ? enabledCapabilities.join(", ") : "none"
				}</supported_capabilities>`,
			)
			.addLine("</model_card>")
			.addLine();

		return builder.build();
	}

	builder
		.addLine("<model_card>")
		.addLine(`<model_id>${activeModelId}</model_id>`)
		.addLine(`<provider>${modelConfig?.provider ?? "unknown"}</provider>`)
		.addLine(
			`<display_name>${modelConfig?.name ?? modelConfig?.matchingModel ?? activeModelId}</display_name>`,
		)
		.addLine(`<input_modalities>${asList(modelConfig?.modalities?.input)}</input_modalities>`)
		.addLine(`<output_modalities>${asList(modelConfig?.modalities?.output)}</output_modalities>`)
		.addLine(`<context_window>${modelConfig?.contextWindow ?? "unspecified"}</context_window>`)
		.addLine(
			`<effective_max_output_tokens>${effectiveMaxOutputTokens}</effective_max_output_tokens>`,
		)
		.addLine(
			`<knowledge_cutoff>${modelConfig?.knowledgeCutoffDate ?? "unspecified"}</knowledge_cutoff>`,
		)
		.addLine(`<release_date>${modelConfig?.releaseDate ?? "unspecified"}</release_date>`)
		.addLine(`<last_updated>${modelConfig?.lastUpdated ?? "unspecified"}</last_updated>`)
		.addLine(
			`<supported_capabilities>${
				enabledCapabilities.length > 0 ? enabledCapabilities.join(", ") : "none"
			}</supported_capabilities>`,
		)
		.addLine("</model_card>")
		.addLine();

	return builder.build();
}
