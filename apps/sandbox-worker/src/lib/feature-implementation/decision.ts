import { extractCommands } from "../commands";
import { safeParseJson } from "../json";

import type { AgentDecision } from "./types";
import { truncateForModel } from "./utils";

function parseScriptLanguage(
	rawLanguage: unknown,
): "javascript" | "typescript" {
	if (typeof rawLanguage !== "string" || !rawLanguage.trim()) {
		return "javascript";
	}

	const normalised = rawLanguage.trim().toLowerCase();
	if (normalised === "javascript" || normalised === "typescript") {
		return normalised;
	}

	throw new Error(`run_script action has unsupported language: ${rawLanguage}`);
}

function extractBalancedObjectCandidates(input: string): string[] {
	const candidates: string[] = [];
	let startIndex = -1;
	let depth = 0;
	let inString = false;
	let isEscaped = false;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];

		if (inString) {
			if (isEscaped) {
				isEscaped = false;
				continue;
			}
			if (char === "\\") {
				isEscaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === "{") {
			if (depth === 0) {
				startIndex = index;
			}
			depth += 1;
			continue;
		}
		if (char === "}") {
			if (depth === 0) {
				continue;
			}
			depth -= 1;
			if (depth === 0 && startIndex !== -1) {
				candidates.push(input.slice(startIndex, index + 1));
				startIndex = -1;
			}
		}
	}

	return candidates;
}

function extractJsonPayloadCandidates(rawResponse: string): string[] {
	const candidates: string[] = [];
	const seen = new Set<string>();
	const pushUnique = (value: string | null) => {
		if (!value) {
			return;
		}
		const trimmed = value.trim();
		if (!trimmed || seen.has(trimmed)) {
			return;
		}
		seen.add(trimmed);
		candidates.push(trimmed);
	};

	const codeBlockMatches = rawResponse.matchAll(
		/```(?:json)?\s*([\s\S]*?)```/gi,
	);
	for (const match of codeBlockMatches) {
		pushUnique(match[1] ?? "");
	}

	const trimmed = rawResponse.trim();
	pushUnique(trimmed);

	for (const candidate of extractBalancedObjectCandidates(rawResponse)) {
		pushUnique(candidate);
	}

	return candidates;
}

function escapeControlCharsInJsonStrings(input: string): string {
	let output = "";
	let inString = false;
	let isEscaped = false;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];

		if (inString) {
			if (isEscaped) {
				output += char;
				isEscaped = false;
				continue;
			}

			if (char === "\\") {
				output += char;
				isEscaped = true;
				continue;
			}

			if (char === '"') {
				output += char;
				inString = false;
				continue;
			}

			if (char === "\n") {
				output += "\\n";
				continue;
			}
			if (char === "\r") {
				output += "\\r";
				continue;
			}
			if (char === "\t") {
				output += "\\t";
				continue;
			}

			output += char;
			continue;
		}

		if (char === '"') {
			inString = true;
		}
		output += char;
	}

	return output;
}

function parseDecisionPayload(payload: string): Record<string, unknown> {
	const parsed = safeParseJson<Record<string, unknown>>(payload);
	if (parsed) {
		return parsed;
	}

	const repairedPayload = escapeControlCharsInJsonStrings(payload);
	const repairedParsed =
		safeParseJson<Record<string, unknown>>(repairedPayload);
	if (repairedParsed) {
		return repairedParsed;
	}

	throw new Error("Unable to parse decision payload as JSON");
}

function inferActionFromFields(parsed: Record<string, unknown>): string {
	if (typeof parsed.action === "string" && parsed.action.trim()) {
		return parsed.action.trim().toLowerCase();
	}

	if (typeof parsed.command === "string" && parsed.command.trim()) {
		return "run_command";
	}
	if (Array.isArray(parsed.commands) && parsed.commands.length > 0) {
		return "run_parallel";
	}
	if (typeof parsed.path === "string" && parsed.path.trim()) {
		return "read_file";
	}
	if (typeof parsed.plan === "string" && parsed.plan.trim()) {
		return "update_plan";
	}
	if (typeof parsed.code === "string" && parsed.code.trim()) {
		return "run_script";
	}
	if (typeof parsed.summary === "string" && parsed.summary.trim()) {
		return "finish";
	}

	return "";
}

export function parseAgentDecision(rawResponse: string): AgentDecision {
	const payloads = extractJsonPayloadCandidates(rawResponse);
	for (const payload of payloads) {
		try {
			const parsed = parseDecisionPayload(payload);
			const actionRaw = inferActionFromFields(parsed);
			const reasoning =
				typeof parsed.reasoning === "string"
					? parsed.reasoning.trim()
					: undefined;

			switch (actionRaw) {
				case "run_command":
				case "execute_command":
				case "command": {
					const command =
						typeof parsed.command === "string" ? parsed.command.trim() : "";
					if (!command) {
						throw new Error("run_command action requires a non-empty command");
					}

					return {
						action: "run_command",
						command,
						reasoning,
					};
				}
				case "run_parallel":
				case "run_commands":
				case "parallel_commands":
				case "batch_commands": {
					if (!Array.isArray(parsed.commands)) {
						throw new Error(
							"run_parallel action requires a commands string array",
						);
					}

					const commands = parsed.commands
						.filter((entry): entry is string => typeof entry === "string")
						.map((entry) => entry.trim())
						.filter(Boolean);
					if (!commands.length) {
						throw new Error(
							"run_parallel action requires at least one non-empty command",
						);
					}

					return {
						action: "run_parallel",
						commands,
						reasoning,
					};
				}
				case "read_file":
				case "read": {
					const path =
						typeof parsed.path === "string" ? parsed.path.trim() : "";
					if (!path) {
						throw new Error("read_file action requires a non-empty path");
					}

					return {
						action: "read_file",
						path,
						startLine:
							typeof parsed.startLine === "number"
								? parsed.startLine
								: undefined,
						endLine:
							typeof parsed.endLine === "number" ? parsed.endLine : undefined,
						reasoning,
					};
				}
				case "update_plan":
				case "revise_plan": {
					const plan =
						typeof parsed.plan === "string" ? parsed.plan.trim() : "";
					if (!plan) {
						throw new Error("update_plan action requires a non-empty plan");
					}

					return {
						action: "update_plan",
						plan,
						reasoning,
					};
				}
				case "finish":
				case "complete":
				case "done": {
					const summary =
						typeof parsed.summary === "string"
							? parsed.summary.trim()
							: "Run completed.";

					return {
						action: "finish",
						summary,
						reasoning,
					};
				}
				case "run_script":
				case "execute_script":
				case "script": {
					const code =
						typeof parsed.code === "string" ? parsed.code.trim() : "";
					if (!code) {
						throw new Error("run_script action requires non-empty code");
					}
					const language = parseScriptLanguage(parsed.language);

					return {
						action: "run_script",
						code,
						language,
						reasoning,
					};
				}
			}
		} catch {
			continue;
		}
	}

	const fallbackCommands = extractCommands(rawResponse);
	if (fallbackCommands.length === 1) {
		return {
			action: "run_command",
			command: fallbackCommands[0],
			reasoning: "Fallback command extraction from model response",
		};
	}

	throw new Error(
		`Invalid agent decision. Expected JSON action payload but received: ${truncateForModel(rawResponse, 300)}`,
	);
}
