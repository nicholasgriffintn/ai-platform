import type {
  AgentApproval,
  AgentHarnessEvent,
  AgentItem,
  AgentTokenUsage,
} from "@ngriffin_uk/polychat-schemas";

const OUTPUT_LIMIT = 20_000;

function itemToolName(item: AgentItem): string {
  switch (item.body.kind) {
    case "command":
      return "command";
    case "file_change":
      return "file_change";
    case "tool":
      return item.body.name;
  }
}

function itemInput(item: AgentItem): unknown {
  switch (item.body.kind) {
    case "command":
      return { command: item.body.command };
    case "file_change":
      return { paths: item.body.paths };
    case "tool":
      return item.body.detail ? { detail: item.body.detail } : undefined;
  }
}

export function createMachineAgentEvents() {
  const events: AgentHarnessEvent[] = [];
  const started = new Set<string>();
  let text = "";
  let reported = { input: 0, output: 0 };

  return {
    text(content: string) {
      if (content.length > text.length && content.startsWith(text)) {
        events.push({ type: "text-delta", partId: "message", delta: content.slice(text.length) });
      }

      text = content;
    },
    reasoning(delta: string) {
      events.push({ type: "reasoning-delta", partId: "reasoning", delta });
    },
    item(item: AgentItem) {
      if (!started.has(item.id)) {
        started.add(item.id);
        events.push({
          type: "tool-started",
          toolCallId: item.id,
          toolName: itemToolName(item),
          input: itemInput(item),
        });
      }

      if (item.status === "running") {
        return;
      }

      started.delete(item.id);
      events.push({
        type: "tool-finished",
        toolCallId: item.id,
        toolName: itemToolName(item),
        ...(item.body.kind === "command" && item.body.output
          ? { output: item.body.output.slice(0, OUTPUT_LIMIT) }
          : {}),
        ...(item.status === "failed" ? { error: "The step failed." } : {}),
      });
    },
    approval(approval: AgentApproval) {
      events.push({
        type: "approval-requested",
        approvalId: approval.requestId,
        toolName: approval.kind,
        description: approval.command ? `Run ${approval.command}` : approval.title,
        ...(approval.detail ? { input: { detail: approval.detail } } : {}),
      });
    },
    usage(usage: AgentTokenUsage) {
      const input = usage.inputTokens + usage.cachedInputTokens + usage.cacheWriteInputTokens;
      const output = usage.outputTokens + usage.reasoningOutputTokens;

      if (input > reported.input || output > reported.output) {
        events.push({
          type: "usage",
          inputTokens: Math.max(0, input - reported.input),
          outputTokens: Math.max(0, output - reported.output),
        });
        reported = {
          input: Math.max(input, reported.input),
          output: Math.max(output, reported.output),
        };
      }
    },
    peek(limit: number): AgentHarnessEvent[] {
      return events.slice(0, limit);
    },
    drop(count: number) {
      events.splice(0, count);
    },
    get pending(): number {
      return events.length;
    },
  };
}
