import { extractCommands } from "../commands";
import { safeParseJson } from "../json";

import type { AgentDecision } from "./types";
import { truncateForModel } from "./utils";

function parseScriptLanguage(
	rawLanguage: unknown,
): "python" | "javascript" | "typescript" {
	if (typeof rawLanguage !== "string" || !rawLanguage.trim()) {
		return "python";
	}

	const normalised = rawLanguage.trim().toLowerCase();
	if (
		normalised === "python" ||
		normalised === "javascript" ||
		normalised === "typescript"
	) {
		return normalised;
	}

	throw new Error(`run_script action has unsupported language: ${rawLanguage}`);
}

function extractJsonPayload(rawResponse: string): string | null {
	const codeBlockMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = codeBlockMatch
		? codeBlockMatch[1].trim()
		: rawResponse.trim();
	if (!candidate) {
		return null;
	}

	if (candidate.startsWith("{") && candidate.endsWith("}")) {
		return candidate;
	}

	const firstBrace = candidate.indexOf("{");
	const lastBrace = candidate.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return candidate.slice(firstBrace, lastBrace + 1);
	}

	return null;
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

export function parseAgentDecision(rawResponse: string): AgentDecision {
	const payload = extractJsonPayload(rawResponse);
	if (payload) {
		try {
			const parsed = parseDecisionPayload(payload);
			const actionRaw =
				typeof parsed.action === "string"
					? parsed.action.trim().toLowerCase()
					: "";
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
			// Fallback to command extraction below.
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
