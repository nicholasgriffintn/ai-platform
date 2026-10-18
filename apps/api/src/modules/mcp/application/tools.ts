import { extractChatCompletionNotification } from "@ngriffin_uk/polychat-ai-providers";
import { toToolInputJsonSchema } from "@ngriffin_uk/polychat-library-tools";
import type { PolyAgendaItem } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readPolyAgenda } from "~/modules/poly/application/read-agenda";
import {
  invokeAssistantRecipe,
  resolveInstalledAssistantRecipe,
} from "~/modules/recipes/application";
import { executeRecipeInvocationChat } from "~/modules/recipes/application/execution";
import { ensureTeammateContext } from "~/modules/teammates/application/contexts";
import { listScopedTeammateSummaries } from "~/modules/teammates/application/listing";
import { enqueueTeammateRun } from "~/modules/teammates/application/run-admission";

import { JSON_RPC_ERRORS, JsonRpcError } from "./protocol";

export interface McpServerToolResult {
  text: string;
  structured?: unknown;
  isError?: boolean;
}

interface McpServerTool<TInput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  run: (context: ServiceContext, input: TInput) => Promise<McpServerToolResult>;
}

function defineServerTool<TInput>(tool: McpServerTool<TInput>): McpServerTool<TInput> {
  return tool;
}

function describeAgendaItem(item: PolyAgendaItem): string {
  return `${item.kind}: ${item.title} (${item.status.replaceAll("_", " ")})`;
}

const listTeammates = defineServerTool({
  name: "list_teammates",
  description: "The teammates you have hired in Polychat, with what each one is for.",
  inputSchema: z.object({}),
  run: async (context) => {
    const teammates = await listScopedTeammateSummaries(context, context.requireUser().id);

    return {
      text:
        teammates.length === 0
          ? "You have not hired any teammates yet."
          : teammates
              .map((teammate) => `${teammate.id}: ${teammate.name}, ${teammate.description}`)
              .join("\n"),
      structured: {
        teammates: teammates.map(({ id, name, description, kind }) => ({
          id,
          name,
          description,
          kind,
        })),
      },
    };
  },
});

const messageTeammate = defineServerTool({
  name: "message_teammate",
  description:
    "Send a message to one of your Polychat teammates in its own conversation. It works with its tools and asks you in Polychat before anything that sends, spends or deletes.",
  inputSchema: z.object({
    teammateId: z.string().min(1).describe("A teammate id from list_teammates"),
    message: z.string().trim().min(1).max(8_000),
  }),
  run: async (context, input) => {
    const user = context.requireUser();
    const teammateContext = await ensureTeammateContext(context, input.teammateId, {
      type: "personal",
      id: String(user.id),
    });
    const response = await enqueueTeammateRun({
      env: context.env,
      context,
      body: {
        conversationId: teammateContext.homeConversationId,
        messages: [{ role: "user", content: input.message }],
        stream: false,
        store: true,
      },
      teammateId: input.teammateId,
      user,
      anonymousUser: undefined,
      authority: { trigger: "channel" },
    });
    const notification = extractChatCompletionNotification(response, {
      streamingMessage: "The teammate is working on it and will reply in Polychat.",
      fallback: "The teammate is working on it and will reply in Polychat.",
    });

    return {
      text: notification.body,
      structured: { conversationId: teammateContext.homeConversationId },
    };
  },
});

const runRoutine = defineServerTool({
  name: "run_routine",
  description:
    "Run one of your installed Polychat routines now. Name it, or describe it and the closest installed routine runs.",
  inputSchema: z.object({
    routine: z.string().trim().min(1).max(200).describe("The routine's id or a description of it"),
    input: z.string().trim().max(4_000).optional(),
  }),
  run: async (context, input) => {
    const user = context.requireUser();
    const match = await resolveInstalledAssistantRecipe({
      context,
      userId: user.id,
      query: input.routine,
    });

    if (match.status !== "matched" || !match.recipe) {
      throw new JsonRpcError(
        JSON_RPC_ERRORS.invalidParams,
        match.status === "ambiguous"
          ? "That matches more than one routine; name one of them"
          : "No installed routine matches that",
        { candidates: match.candidates },
      );
    }

    const invocation = await invokeAssistantRecipe(match.recipe.id, {
      context,
      userId: user.id,
      channel: "tool",
      input: input.input,
      requireInstalled: true,
    });

    if (!invocation || invocation.status !== "ready") {
      return {
        text: invocation?.conversationStarter ?? "That routine is not ready to run.",
        isError:
          !invocation || invocation.status === "blocked" || invocation.status === "not_installed",
      };
    }

    const execution = await executeRecipeInvocationChat({
      env: context.env,
      context,
      user,
      invocation,
    });
    const notification = extractChatCompletionNotification(execution.response, {
      streamingMessage: "The routine is running and will report in Polychat.",
    });

    return {
      text: notification.body,
      structured: { recipeId: match.recipe.id, conversationId: execution.conversationId },
    };
  },
});

const readAttention = defineServerTool({
  name: "read_attention",
  description:
    "What is waiting on you in Polychat: approvals, questions, what teammates are working on and what Poly noted.",
  inputSchema: z.object({}),
  run: async (context) => {
    const agenda = await readPolyAgenda(context);
    const lines = [
      ...agenda.needs_you.map((item) => `Needs you, ${describeAgendaItem(item)}`),
      ...agenda.working_on.map((item) => `Working, ${describeAgendaItem(item)}`),
      ...agenda.noted.map((item) => `Noted, ${describeAgendaItem(item)}`),
    ];

    return {
      text: lines.length === 0 ? "Nothing is waiting on you." : lines.join("\n"),
      structured: {
        needs_you: agenda.needs_you,
        working_on: agenda.working_on,
        noted: agenda.noted,
      },
    };
  },
});

export const MCP_SERVER_TOOLS: readonly McpServerTool<any>[] = [
  listTeammates,
  messageTeammate,
  runRoutine,
  readAttention,
];

export function listMcpServerTools() {
  return MCP_SERVER_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toToolInputJsonSchema(tool.inputSchema),
  }));
}

export async function callMcpServerTool(
  context: ServiceContext,
  name: string,
  rawArguments: unknown,
): Promise<McpServerToolResult> {
  const tool = MCP_SERVER_TOOLS.find((candidate) => candidate.name === name);

  if (!tool) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${name}`);
  }

  const parsed = tool.inputSchema.safeParse(rawArguments ?? {});

  if (!parsed.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "Invalid tool arguments", {
      issues: parsed.error.issues,
    });
  }

  return tool.run(context, parsed.data);
}
