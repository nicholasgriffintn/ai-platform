import type { AgentTraceEntry } from "~/lib/agent-trace";

export function getAgentTraceTypeLabel(type: AgentTraceEntry["type"]): string {
	switch (type) {
		case "user_turn":
			return "User";
		case "model_call":
			return "Model";
		case "assistant_response":
			return "Assistant";
		case "tool_call":
			return "Tool call";
		case "tool_result":
			return "Tool result";
		case "approval":
			return "Approval";
		case "retry":
			return "Retry";
		case "provider_error":
			return "Provider error";
	}
}

export function formatAgentTraceUsage(entry: AgentTraceEntry): string | undefined {
	if (!entry.usage) {
		return undefined;
	}

	if (typeof entry.usage.costUsd === "number") {
		return `$${entry.usage.costUsd.toFixed(4)}`;
	}

	if (typeof entry.usage.totalTokens === "number") {
		return `${entry.usage.totalTokens.toLocaleString()} tokens`;
	}

	const parts = [
		typeof entry.usage.inputTokens === "number"
			? `${entry.usage.inputTokens.toLocaleString()} in`
			: undefined,
		typeof entry.usage.outputTokens === "number"
			? `${entry.usage.outputTokens.toLocaleString()} out`
			: undefined,
	].filter(Boolean);
	return parts.length ? parts.join(" / ") : undefined;
}

export function formatAgentTraceLatency(entry: AgentTraceEntry): string | undefined {
	if (typeof entry.latencyMs !== "number") {
		return undefined;
	}

	return entry.latencyMs >= 1000
		? `${(entry.latencyMs / 1000).toFixed(1)}s`
		: `${entry.latencyMs}ms`;
}
