import type { ChatRequestOptions, IUserSettings } from "~/types";
import { PromptBuilder } from "./builder";
import { buildAssistantMetadataSection, type PromptModelMetadata } from "./sections/metadata";
import { buildUserContextSection } from "./sections/user-context";
import type { PromptRequest } from ".";

function buildSandboxContext(options: ChatRequestOptions["sandbox"]): string {
	if (!options?.enabled) {
		return "";
	}

	const lines = [
		"<sandbox_context>",
		options.repo ? `Repository: ${options.repo}` : "Repository: not selected",
		typeof options.installationId === "number"
			? `GitHub installation ID: ${options.installationId}`
			: "GitHub installation ID: not selected",
		options.taskType ? `Task type: ${options.taskType}` : "Task type: feature-implementation",
		options.promptStrategy ? `Prompt strategy: ${options.promptStrategy}` : "Prompt strategy: auto",
		typeof options.shouldCommit === "boolean"
			? `Commit changes: ${options.shouldCommit ? "yes" : "no"}`
			: "Commit changes: no",
		typeof options.timeoutSeconds === "number"
			? `Timeout seconds: ${options.timeoutSeconds}`
			: "Timeout seconds: default",
		"</sandbox_context>",
	];

	return lines.join("\n");
}

export function returnSandboxPrompt(
	request: PromptRequest,
	userSettings?: IUserSettings,
	modelMetadata?: PromptModelMetadata,
): string {
	const sandboxOptions = request.options?.sandbox;
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
	});

	return new PromptBuilder(metadataSection)
		.addLine(
			"<assistant_info>You are the chat-side controller for sandbox coding work. Your job is to translate the user's request into the correct sandbox tool call, then report the worker result clearly.</assistant_info>",
		)
		.addLine(
			"<instruction_precedence><order>system > sandbox_context > tool_contract > user_request</order><conflict_rule>If the user's request conflicts with sandbox context or safety constraints, follow the higher-precedence instruction and state the limitation briefly.</conflict_rule></instruction_precedence>",
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
		.add(buildSandboxContext(sandboxOptions))
		.addLine()
		.addLine("<tool_contract>")
		.addLine(
			"- Use the enabled sandbox tool for implementation, bug fixing, tests, refactors, reviews, documentation, and migration work.",
		)
		.addLine("- Do not answer coding-work requests manually when sandbox mode is enabled.")
		.addLine("- Do not use unrelated tools for sandbox work.")
		.addLine(
			"- Pass the user's task crisply, preserving constraints, repo, task type, commit preference, prompt strategy, timeout, and installation ID from sandbox context.",
		)
		.addLine(
			"- If no repository is selected, ask the user to pick a repository before calling tools.",
		)
		.addLine("</tool_contract>")
		.addLine()
		.addLine("<response_contract>")
		.addLine(
			"- Before tool completion, keep text minimal and let streaming tool events carry progress.",
		)
		.addLine(
			"- After the tool returns, summarise status, branch, useful logs, diff summary, errors, and next action when those fields are present.",
		)
		.addLine(
			"- If the worker fails, report the failure directly and preserve the actionable error.",
		)
		.addLine("</response_contract>")
		.build();
}
