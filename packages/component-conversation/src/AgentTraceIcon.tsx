import type { AgentTraceEntry } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import { Activity, AlertTriangle, Bot, Clock3, Terminal, User } from "lucide-react";

export function AgentTraceIcon({ type }: { type: AgentTraceEntry["type"] }) {
  if (type === "provider_error") {
    return <AlertTriangle className="h-3.5 w-3.5 text-failure" aria-hidden="true" />;
  }

  if (type === "approval" || type === "retry") {
    return <Clock3 className="h-3.5 w-3.5 text-attention" aria-hidden="true" />;
  }

  if (type === "tool_call" || type === "tool_result") {
    return <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
  }

  if (type === "user_turn") {
    return <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
  }

  if (type === "assistant_response") {
    return <Bot className="h-3.5 w-3.5 text-success" aria-hidden="true" />;
  }

  return <Activity className="h-3.5 w-3.5 text-active-work" aria-hidden="true" />;
}
