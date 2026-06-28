import { Activity, AlertTriangle, Bot, Clock3, Terminal, User } from "lucide-react";

import type { AgentTraceEntry } from "~/lib/agent-trace";

export function AgentTraceIcon({ type }: { type: AgentTraceEntry["type"] }) {
	if (type === "provider_error") {
		return <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />;
	}
	if (type === "approval" || type === "retry") {
		return <Clock3 className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />;
	}
	if (type === "tool_call" || type === "tool_result") {
		return <Terminal className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />;
	}
	if (type === "user_turn") {
		return <User className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />;
	}
	if (type === "assistant_response") {
		return <Bot className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />;
	}
	return <Activity className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />;
}
