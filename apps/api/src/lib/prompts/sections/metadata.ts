import { APP_DESCRIPTION, APP_NAME } from "~/constants/app";
import type { IBody, ModelConfigItem } from "~/types";
import { PromptBuilder } from "../builder";

export interface PromptModelMetadata {
	modelId?: string;
	modelConfig?: ModelConfigItem;
}

interface AssistantMetadataSectionOptions extends PromptModelMetadata {
	request: Partial<IBody>;
	format?: "full" | "compact";
}

const PLATFORM_CAPABILITIES = [
	"adaptive_model_routing",
	"agentic_tool_orchestration",
	"retrieval_augmented_memories",
	"artifact_based_outputs",
	"search_grounding_support",
];

function asList(values?: string[]): string {
	return values && values.length > 0 ? values.join(", ") : "unspecified";
}

function toBooleanString(value?: boolean): string {
	return value ? "true" : "false";
}

export function buildAssistantMetadataSection({
	request,
	modelId,
	modelConfig,
	format = "full",
}: AssistantMetadataSectionOptions): string {
	const activeModelId =
		modelId || request.model || modelConfig?.matchingModel || "unknown";

	const builder = new PromptBuilder("<session_metadata>")
		.addLine()
		.addLine("<application_info>")
		.addLine(`<name>${APP_NAME}</name>`)
		.addLine(`<description>${APP_DESCRIPTION}</description>`)
		.addLine("<capabilities>");

	PLATFORM_CAPABILITIES.forEach((capability) => {
		builder.addLine(`<capability>${capability}</capability>`);
	});

	builder
		.addLine("</capabilities>")
		.addLine(
			`<active_mode>${request.mode ? request.mode : "standard"}</active_mode>`,
		)
		.addIf(
			!!request.platform,
			`<origin_platform>${request.platform}</origin_platform>`,
		)
		.addLine(
			`<response_mode>${request.response_mode || "normal"}</response_mode>`,
		)
		.addIf(
			!!request.lang,
			`<preferred_language>${request.lang}</preferred_language>`,
		)
		.addLine("</application_info>")
		.addLine();

	const enabledCapabilities = [
		modelConfig?.supportsToolCalls ? "tool_calls" : null,
		modelConfig?.supportsArtifacts ? "artifacts" : null,
		modelConfig?.supportsReasoning ? "reasoning" : null,
		modelConfig?.supportsDocuments ? "documents" : null,
		modelConfig?.supportsSearchGrounding ? "search_grounding" : null,
		modelConfig?.supportsCodeExecution ? "code_execution" : null,
		modelConfig?.supportsAttachments ? "attachments" : null,
		modelConfig?.supportsResponseFormat ? "response_format" : null,
	].filter(Boolean);

	if (format === "compact") {
		builder
			.addLine("<model_info>")
			.addLine(`<model_id>${activeModelId}</model_id>`)
			.addLine(`<provider>${modelConfig?.provider ?? "unknown"}</provider>`)
			.addLine(
				`<context_window>${modelConfig?.contextWindow ?? "unspecified"}</context_window>`,
			)
			.addLine(
				`<max_tokens>${modelConfig?.maxTokens ?? "unspecified"}</max_tokens>`,
			)
			.addLine(
				`<enabled_capabilities>${
					enabledCapabilities.length > 0
						? enabledCapabilities.join(", ")
						: "none"
				}</enabled_capabilities>`,
			)
			.addLine(
				"<note>If code_execution is enabled at runtime, its outputs must be summarised in chat; raw outputs and long code go into artifacts or fenced blocks.</note>",
			)
			.addLine("</model_info>")
			.addLine("</session_metadata>")
			.addLine();

		return builder.build();
	}

	builder
		.addLine("<model_info>")
		.addLine(`<model_id>${activeModelId}</model_id>`)
		.addLine(`<provider>${modelConfig?.provider ?? "unknown"}</provider>`)
		.addLine(
			`<display_name>${modelConfig?.name ?? modelConfig?.matchingModel ?? activeModelId}</display_name>`,
		)
		.addLine(
			`<input_modalities>${asList(modelConfig?.modalities?.input)}</input_modalities>`,
		)
		.addLine(
			`<output_modalities>${asList(modelConfig?.modalities?.output)}</output_modalities>`,
		)
		.addLine(
			`<context_window>${modelConfig?.contextWindow ?? "unspecified"}</context_window>`,
		)
		.addLine(
			`<max_tokens>${modelConfig?.maxTokens ?? "unspecified"}</max_tokens>`,
		)
		.addLine(
			`<knowledge_cutoff>${
				modelConfig?.knowledgeCutoffDate ?? "unspecified"
			}</knowledge_cutoff>`,
		)
		.addLine(
			`<release_date>${modelConfig?.releaseDate ?? "unspecified"}</release_date>`,
		)
		.addLine(
			`<last_updated>${modelConfig?.lastUpdated ?? "unspecified"}</last_updated>`,
		)
		.addLine(
			`<enabled_capabilities>${
				enabledCapabilities.length > 0 ? enabledCapabilities.join(", ") : "none"
			}</enabled_capabilities>`,
		)
		.addLine(
			"<note>If code_execution is enabled at runtime, its outputs must be summarised in chat; raw outputs and long code go into artifacts or fenced blocks.</note>",
		)
		.addLine("</model_info>")
		.addLine("</session_metadata>")
		.addLine();

	return builder.build();
}
