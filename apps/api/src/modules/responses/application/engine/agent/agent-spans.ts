import type { NormalisedTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";
import * as Sentry from "@sentry/cloudflare";

const AGENT_NAME = "polychat";

export function withAgentRunSpan<T extends { response: { usage?: NormalisedTokenUsage } }>(
  run: { model: string; provider: string; mode: string; conversationId: string; runId?: string },
  execute: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `invoke_agent ${AGENT_NAME}`,
      op: "gen_ai.invoke_agent",
      forceTransaction: true,
      attributes: omitNullishValues({
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": AGENT_NAME,
        "gen_ai.system": run.provider,
        "gen_ai.request.model": run.model,
        "gen_ai.conversation.id": run.conversationId,
        "polychat.mode": run.mode,
        "polychat.run_id": run.runId,
      }),
    },
    async (span) => {
      const result = await execute();
      const usage = result.response.usage;

      if (usage) {
        span.setAttributes({
          "gen_ai.usage.input_tokens": usage.input_tokens,
          "gen_ai.usage.output_tokens": usage.output_tokens,
          "gen_ai.usage.total_tokens": usage.total_tokens,
        });
      }

      return result;
    },
  );
}

export function withToolSpan<T>(
  tool: { name: string; callId: string },
  execute: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `execute_tool ${tool.name}`,
      op: "gen_ai.execute_tool",
      onlyIfParent: true,
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": tool.name,
        "gen_ai.tool.call.id": tool.callId,
      },
    },
    execute,
  );
}
