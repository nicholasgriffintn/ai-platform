import type { ParsedSandboxCommand } from "./command";

function toRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function getPossibleContainers(
	payload: Record<string, unknown>,
): Record<string, unknown>[] {
	return [
		payload,
		toRecord(payload.client_payload),
		toRecord(payload.inputs),
		toRecord(payload.workflow_dispatch),
	].filter(Boolean) as Record<string, unknown>[];
}

export function parseSandboxAutomationCommand(
	payload: Record<string, unknown>,
): ParsedSandboxCommand | null {
	for (const container of getPossibleContainers(payload)) {
		const commandValue =
			typeof container.command === "string"
				? container.command
				: typeof container.sandbox_command === "string"
					? container.sandbox_command
					: undefined;
		const command = commandValue?.trim().toLowerCase().replace(/^\//, "");
		if (!command || !["implement", "review", "test", "fix"].includes(command)) {
			continue;
		}

		return {
			command: command as ParsedSandboxCommand["command"],
			task:
				typeof container.task === "string"
					? container.task.trim()
					: typeof container.sandbox_task === "string"
						? container.sandbox_task.trim()
						: "",
		};
	}

	return null;
}

export function parseSandboxShouldCommit(
	payload: Record<string, unknown>,
): boolean | undefined {
	for (const container of getPossibleContainers(payload)) {
		const rawValue =
			container.should_commit ?? container.shouldCommit ?? container.commit;
		if (typeof rawValue === "boolean") {
			return rawValue;
		}
		if (typeof rawValue === "string") {
			const normalized = rawValue.trim().toLowerCase();
			if (normalized === "true") {
				return true;
			}
			if (normalized === "false") {
				return false;
			}
		}
	}

	return undefined;
}

export function parseIssueNumberFromAutomationPayload(
	payload: Record<string, unknown>,
): number | undefined {
	for (const container of getPossibleContainers(payload)) {
		const raw =
			container.issue_number ??
			container.issueNumber ??
			container.pr_number ??
			container.prNumber;
		if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
			return raw;
		}
		if (typeof raw === "string") {
			const parsed = Number.parseInt(raw.trim(), 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				return parsed;
			}
		}
	}

	return undefined;
}
