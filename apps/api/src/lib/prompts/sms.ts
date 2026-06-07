import type { ChatRequestOptions, IUserSettings } from "~/types";
import { PromptBuilder } from "./builder";
import { buildAssistantMetadataSection, type PromptModelMetadata } from "./sections/metadata";
import { buildUserContextSection } from "./sections/user-context";
import type { PromptRequest } from ".";

function buildSmsContext(options: ChatRequestOptions["sms"]): string {
	if (!options?.enabled) {
		return "";
	}

	const lines = [
		"<sms_context>",
		"Channel: SMS",
		"Input length is limited and replies may be split or truncated by carriers.",
		options.from ? `Sender: ${options.from}` : "Sender: unavailable",
		options.to ? `Recipient: ${options.to}` : "Recipient: unavailable",
		"</sms_context>",
	];

	return lines.join("\n");
}

export function returnSmsPrompt(
	request: PromptRequest,
	userSettings?: IUserSettings,
	modelMetadata?: PromptModelMetadata,
): string {
	const smsOptions = request.options?.sms;
	const preferredLanguage = request.lang?.trim() || null;
	const date = request.date || new Date().toISOString().split("T")[0];
	const userNickname = userSettings?.nickname || null;
	const userJobRole = userSettings?.job_role || null;
	const latitude = request.location?.latitude ?? null;
	const longitude = request.location?.longitude ?? null;
	const metadataSection = buildAssistantMetadataSection({
		request: preferredLanguage ? { ...request, lang: preferredLanguage } : request,
		modelId: modelMetadata?.modelId,
		modelConfig: modelMetadata?.modelConfig,
		format: "compact",
	});

	return new PromptBuilder(metadataSection)
		.addLine(
			"<assistant_info>You are Polychat replying in an SMS conversation. Help the user trigger recipes, check task status, and answer short questions without assuming access beyond enabled tools.</assistant_info>",
		)
		.addLine(
			"<instruction_precedence><order>system > sms_context > tool_contract > user_request</order><conflict_rule>If the user's request conflicts with SMS, privacy, or tool constraints, follow the higher-precedence instruction and state the limitation briefly.</conflict_rule></instruction_precedence>",
		)
		.addLine()
		.add(
			buildUserContextSection({
				date,
				userNickname,
				userJobRole,
				latitude,
				longitude,
				language: preferredLanguage,
			}),
		)
		.addLine()
		.add(buildSmsContext(smsOptions))
		.addLine()
		.addLine("<tool_contract>")
		.addLine("- Use recipe tools when the user asks to run or manage an installed recipe.")
		.addLine("- Use only the tools enabled for the SMS request.")
		.addLine("- Ask before external writes or actions that change third-party systems.")
		.addLine("- Do not expose secrets, tokens, phone numbers, or private configuration values.")
		.addLine("</tool_contract>")
		.addLine()
		.addLine("<response_contract>")
		.addLine("- Keep replies concise and plain-text.")
		.addLine("- Do not use markdown tables.")
		.addLine("- Prefer one clear next action when setup, confirmation, or clarification is needed.")
		.addLine("</response_contract>")
		.build();
}
