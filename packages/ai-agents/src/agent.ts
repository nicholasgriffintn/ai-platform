import { createAi, type Ai } from "@ngriffin_uk/polychat-ai-functions";
import { buildAgentSystemPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import type {
  Message,
  ProviderEnv,
  ProviderRuntime,
  ProviderUser,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  executeAgentLoop,
  type AgentConfig,
  type AgentEvent,
  type AgentLoopResult,
  type AgentMessage,
  type AgentToolCall,
  type AgentTurn,
} from "@ngriffin_uk/polychat-library-agent-loop";
import {
  AGENT_CONTROL_TOOL_NAMES,
  createToolCatalogue,
  executeTool,
  isToolError,
  teammateControlToolDeclarations,
  toToolDeclaration,
  type ToolCatalogue,
  type ToolDeclaration,
  type ToolDefinition,
  type AnyToolExecutionContext,
  type ToolExecutionContext,
  type ToolResult,
} from "@ngriffin_uk/polychat-library-tools";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { parseToolCallArguments } from "@ngriffin_uk/polychat-utility-server/tool-calls";

export interface AgentDefinition<TContext extends AnyToolExecutionContext = ToolExecutionContext> {
  name: string;
  model: string;
  provider?: string;
  role?: string;
  objective?: string;
  instructions?: string;
  tools?: ToolDefinition<any, any, TContext>[];
  config?: Partial<AgentConfig>;
  maxObservationChars?: number;
}

export interface AgentRunInput<TContext extends AnyToolExecutionContext> {
  env: ProviderEnv;
  user?: ProviderUser;
  prompt?: string;
  messages?: AgentMessage[];
  plan?: string;
  context: TContext;
  emit?: (event: AgentEvent) => Promise<void> | void;
  signal?: AbortSignal;
}

export interface AgentRunResult extends AgentLoopResult {
  messages: AgentMessage[];
  toolCalls: number;
}

export interface AgentInstance<TContext extends AnyToolExecutionContext = ToolExecutionContext> {
  readonly definition: AgentDefinition<TContext>;
  readonly tools: ToolCatalogue<ToolDefinition<any, any, TContext>>;
  readonly declarations: ToolDeclaration[];
  systemPrompt(): string;
  run(input: AgentRunInput<TContext>): Promise<AgentRunResult>;
  do(toolName: string, input: unknown, context: TContext): Promise<ToolResult>;
}

function toProviderMessage(message: AgentMessage): Message {
  return {
    role: message.role,
    name: message.name,
    content: (message.content ?? "") as Message["content"],
    tool_calls: message.tool_calls as Message["tool_calls"],
    tool_call_id: message.tool_call_id,
    tool_call_arguments: message.tool_call_arguments,
    status: message.status,
  };
}

function readName(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function parseAgentToolCalls(raw: unknown): AgentToolCall[] {
  if (!isRecord(raw) || !Array.isArray(raw.tool_calls)) {
    return [];
  }

  return raw.tool_calls.filter(isRecord).map((toolCall) => {
    const fn = isRecord(toolCall.function) ? toolCall.function : undefined;

    return {
      id: typeof toolCall.id === "string" && toolCall.id ? toolCall.id : generateId(),
      name: readName(fn?.name) ?? readName(toolCall.name) ?? "unknown",
      arguments: parseToolCallArguments(fn?.arguments ?? toolCall.arguments),
      raw: toolCall,
    };
  });
}

export { buildAgentSystemPrompt };

function stringifyToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (isRecord(result) && typeof result.content === "string") {
    return result.content;
  }

  return JSON.stringify(result ?? null);
}

export function Agent<TContext extends AnyToolExecutionContext = ToolExecutionContext>(
  definition: AgentDefinition<TContext>,
  runtime: ProviderRuntime,
  ai: Ai = createAi(runtime),
): AgentInstance<TContext> {
  const tools = createToolCatalogue(definition.tools ?? []);
  const declarations = [
    ...tools.list().map((tool) => toToolDeclaration(tool)),
    ...teammateControlToolDeclarations,
  ];

  const resolveTurn = async (
    input: AgentRunInput<TContext>,
    messages: AgentMessage[],
  ): Promise<AgentTurn> => {
    const { raw, text } = await ai.complete({
      env: input.env,
      user: input.user,
      completion_id: input.context.completionId,
      model: definition.model,
      provider: definition.provider,
      messages: messages.map(toProviderMessage),
      available_functions: declarations,
      tool_choice: "auto",
    });
    const toolCalls = parseAgentToolCalls(raw);

    return {
      toolCalls,
      text,
      assistantMessage: {
        role: "assistant",
        content: text,
        tool_calls: toolCalls.map((toolCall) => toolCall.raw ?? toolCall),
      },
      raw,
    };
  };

  const run = async (input: AgentRunInput<TContext>): Promise<AgentRunResult> => {
    const messages: AgentMessage[] = [
      { role: "system", content: buildAgentSystemPrompt(definition) },
      ...(input.messages ?? []),
    ];

    if (input.prompt) {
      messages.push({ role: "user", content: input.prompt });
    }

    let toolCallCount = 0;
    const maxObservationChars = definition.maxObservationChars ?? 5000;
    const result = await executeAgentLoop<AgentRunInput<TContext>, { commandCount: number }>({
      initialMessages: messages,
      initialPlan: input.plan ?? "",
      shared: input,
      state: { commandCount: 0 },
      config: definition.config,
      emit: input.emit
        ? async (event) => {
            await input.emit?.(event);
          }
        : undefined,
      guardExecution: async (abortMessage) => {
        if (input.signal?.aborted) {
          throw new Error(abortMessage);
        }
      },
      resolveTurn: (context) => resolveTurn(input, context.messages),
      executeToolCalls: async (toolCalls, context) => {
        for (const toolCall of toolCalls) {
          if (AGENT_CONTROL_TOOL_NAMES.has(toolCall.name)) {
            continue;
          }

          toolCallCount += 1;
          context.state.commandCount += 1;

          let content: string;
          let status = "success";

          try {
            const tool = tools.resolve(toolCall.name);
            const toolResult = await executeTool(tool, toolCall.arguments, input.context);

            content = stringifyToolResult(toolResult);
            status = typeof toolResult?.status === "string" ? toolResult.status : status;
          } catch (error) {
            status = "error";
            content =
              isToolError(error) || error instanceof Error
                ? `Tool ${toolCall.name} failed: ${error.message}`
                : `Tool ${toolCall.name} failed`;
          }

          context.messages.push({
            role: "tool",
            name: toolCall.name,
            tool_call_id: toolCall.id,
            tool_call_arguments: toolCall.arguments,
            content:
              content.length > maxObservationChars
                ? `${content.slice(0, maxObservationChars)}\n... (truncated)`
                : content,
            status,
          });
          await context.emit({ type: "agent.tool", tool: toolCall.name, status });
        }
      },
    });

    return { ...result, messages, toolCalls: toolCallCount };
  };

  return {
    definition,
    tools,
    declarations,
    systemPrompt: () => buildAgentSystemPrompt(definition),
    run,
    do: (toolName, input, context) => executeTool(tools.resolve(toolName), input, context),
  };
}
