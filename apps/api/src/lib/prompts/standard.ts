import type { IBody, IUser, IUserSettings } from "~/types";
import { getLogger } from "~/utils/logger";
import { PromptBuilder } from "./builder";
import { resolvePromptLayout } from "./layout";
import { buildAgentGuidelinesSection } from "./sections/agent-guidelines";
import {
	buildAssistantMetadataSection,
	type PromptModelMetadata,
} from "./sections/metadata";
import { buildAssistantPrinciplesSection } from "./sections/principles";
import { buildStandardExampleOutputSection } from "./sections/examples";
import { buildUserContextSection } from "./sections/user-context";
import { buildSafetyStandardsSection } from "./sections/safety";
import { getResponseStyle, resolvePromptCapabilities } from "./utils";

const logger = getLogger({ prefix: "lib/prompts/standard" });

export async function returnStandardPrompt(
	request: IBody,
	user?: IUser,
	userSettings?: IUserSettings,
	supportsToolCalls?: boolean,
	supportsArtifacts?: boolean,
	supportsReasoning?: boolean,
	requiresThinkingPrompt?: boolean,
	modelMetadata?: PromptModelMetadata,
): Promise<string> {
	try {
		const chatMode = request.mode || "standard";

		const userNickname = userSettings?.nickname || null;
		const userJobRole = userSettings?.job_role || null;
		const userTraits = userSettings?.traits || null;
		const userPreferences = userSettings?.preferences || null;
		const memoriesEnabled =
			userSettings?.memories_save_enabled ||
			userSettings?.memories_chat_history_enabled;

		const latitude = request.location?.latitude || user?.latitude;
		const longitude = request.location?.longitude || user?.longitude;
		const date = request.date || new Date().toISOString().split("T")[0];
		const verbosity = request.text?.verbosity ?? request.verbosity ?? "medium";
		const preferredLanguage = request.lang?.trim() || null;

		const isAgent = chatMode === "agent";

		const capabilities = resolvePromptCapabilities({
			supportsToolCalls,
			supportsArtifacts,
			supportsReasoning,
			requiresThinkingPrompt,
			modelMetadata,
		});

		const layout = resolvePromptLayout({
			contextWindow: modelMetadata?.modelConfig?.contextWindow,
			isAgent,
			isCoding: false,
			capabilities,
		});

		const {
			traits,
			preferences,
			problemBreakdownInstructions,
			answerFormatInstructions,
		} = getResponseStyle(
			verbosity,
			capabilities.supportsReasoning,
			capabilities.requiresThinkingPrompt,
			capabilities.supportsToolCalls,
			capabilities.supportsArtifacts,
			isAgent,
			memoriesEnabled,
			userTraits,
			userPreferences,
			false,
			layout.instructionVariant,
		);

		const metadataSection = buildAssistantMetadataSection({
			request: preferredLanguage
				? { ...request, lang: preferredLanguage }
				: request,
			modelId: modelMetadata?.modelId,
			modelConfig: modelMetadata?.modelConfig,
			format: layout.metadataFormat,
		});

		const principlesSection = buildAssistantPrinciplesSection({
			isAgent,
			supportsToolCalls: capabilities.supportsToolCalls,
			supportsArtifacts: capabilities.supportsArtifacts,
			supportsReasoning: capabilities.supportsReasoning,
			verbosity,
			preferredLanguage,
			format: layout.principlesFormat,
		});

		const userContextSection = buildUserContextSection({
			date,
			userNickname,
			userJobRole,
			latitude,
			longitude,
			language: preferredLanguage,
		});

		const builder = new PromptBuilder(metadataSection)
			.addLine(
				isAgent
					? "<assistant_info>You are a helpful agent with access to a range of powerful tools that extend your capabilities.</assistant_info>"
					: "<assistant_info>You are an AI assistant helping with daily tasks.</assistant_info>",
			)
			.addLine(
				"<instruction_precedence>\n<order>system > safety_standards > assistant_principles > response_preferences > example_output</order>\n<conflict_rule>If instructions conflict, follow the higher-precedence item and briefly note any limitation to the user if it affects the answer.</conflict_rule>\n</instruction_precedence>",
			)
			.addLine()
			.add(principlesSection)
			.add(
				buildSafetyStandardsSection({
					preferredLanguage,
				}),
			)
			.addLine(`<response_traits>${traits}</response_traits>`)
			.addLine(`<response_preferences>${preferences}</response_preferences>`)
			.addLine()
			.add(userContextSection);

		if (layout.exampleVariant !== "omit") {
			builder.add(
				buildStandardExampleOutputSection({
					supportsReasoning: capabilities.supportsReasoning,
					supportsArtifacts: capabilities.supportsArtifacts,
					problemBreakdownInstructions,
					answerFormatInstructions,
					variant: layout.exampleVariant === "full" ? "full" : "compact",
					artifactVariant: layout.artifactExampleVariant,
				}),
			);
		}

		if (isAgent) {
			builder.add(buildAgentGuidelinesSection());
		}

		return builder.build();
	} catch (error) {
		logger.error("Error generating standard prompt", { error });
		return "";
	}
}
