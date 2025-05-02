import { MCPClientManager } from "agents/mcp/client";
import { type Context, Hono } from "hono";
import { validator as zValidator } from "hono-openapi/zod";
import type z from "zod";

import { allowRestrictedPaths } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requireTurnstileToken } from "~/middleware/turnstile";
import { AgentRepository } from "~/repositories/AgentRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { IEnv } from "~/types";
import type { ChatCompletionParameters } from "~/types";
import { createAgentSchema, updateAgentSchema } from "./schemas/agents";
import { createChatCompletionsJsonSchema } from "./schemas/chat";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("AGENTS");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);
  await allowRestrictedPaths(ctx, next);
});

app.get("/", async (ctx: Context) => {
  const user = ctx.get("user");
  const repo = new AgentRepository(ctx.env);
  const agents = await repo.getAgentsByUser(user.id);
  return ctx.json({
    status: "success",
    data: agents,
  });
});

app.post("/", zValidator("json", createAgentSchema), async (ctx: Context) => {
  const body = ctx.req.valid("json" as never) as z.infer<
    typeof createAgentSchema
  >;
  const user = ctx.get("user");
  const repo = new AgentRepository(ctx.env);
  const agent = await repo.createAgent(
    user.id,
    body.name,
    body.description ?? "",
    body.avatar_url ?? null,
    body.servers,
  );
  return ctx.json({
    status: "success",
    data: agent,
  });
});

app.get("/:agentId", async (ctx: Context) => {
  const { agentId } = ctx.req.param();
  const user = ctx.get("user");
  const repo = new AgentRepository(ctx.env);
  const agent = await repo.getAgentById(agentId);
  if (!agent) return ctx.json({ error: "Agent not found" }, 404);
  if (agent.user_id !== user.id) return ctx.json({ error: "Forbidden" }, 403);
  return ctx.json({
    status: "success",
    data: agent,
  });
});

app.put(
  "/:agentId",
  zValidator("json", updateAgentSchema),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof updateAgentSchema
    >;
    const user = ctx.get("user");
    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);
    if (!agent) return ctx.json({ error: "Agent not found" }, 404);
    if (agent.user_id !== user.id) return ctx.json({ error: "Forbidden" }, 403);
    await repo.updateAgent(agentId, body);
    return ctx.json({
      status: "success",
      data: agent,
    });
  },
);

app.delete("/:agentId", async (ctx: Context) => {
  const { agentId } = ctx.req.param();
  const user = ctx.get("user");
  const repo = new AgentRepository(ctx.env);
  const agent = await repo.getAgentById(agentId);
  if (!agent) return ctx.json({ error: "Agent not found" }, 404);
  if (agent.user_id !== user.id) return ctx.json({ error: "Forbidden" }, 403);
  await repo.deleteAgent(agentId);
  return ctx.json({
    status: "success",
  });
});

// Chat with an agent via MCP-backed tools and standard chat service
app.post(
  "/:agentId/completions",
  requireTurnstileToken,
  zValidator("json", createChatCompletionsJsonSchema),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");
    const anonymousUser = ctx.get("anonymousUser");

    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);

    if (!agent) {
      return ctx.json(
        {
          status: "error",
          error: "Agent not found",
        },
        404,
      );
    }

    if (agent.user_id !== user.id) {
      return ctx.json(
        {
          status: "error",
          error: "Forbidden",
        },
        403,
      );
    }

    const body = ctx.req.valid("json" as never) as ChatCompletionParameters;

    const mcpFunctions: Array<{
      name: string;
      description?: string;
      parameters: Record<string, any>;
    }> = [];
    try {
      const serversJson = agent.servers as string;

      const serverConfigs = JSON.parse(serversJson) as Array<{ url: string }>;
      const mcp = new MCPClientManager(agent.id, "1.0.0");

      for (const cfg of serverConfigs) {
        try {
          const { id } = await mcp.connect(cfg.url);
          if (mcp.mcpConnections[id]?.connectionState === "ready") {
            const rawTools = (await mcp.unstable_getAITools()) as any;

            const defs = Object.values(rawTools) as any[];

            for (const def of defs) {
              const toolName =
                def.name || `mcp_tool_${mcpFunctions.length + 1}`;

              mcpFunctions.push({
                name: toolName,
                description: def.description as string,
                parameters: def.parameters as Record<string, any>,
              });
            }
          }
        } catch (e) {
          console.error("Error connecting to MCP", e);
        }
      }
    } catch (e) {
      console.error("Error getting MCP functions", e);
    }

    const functionSchemas = mcpFunctions.map((fn) => ({
      type: "function" as const,
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));

    const requestParams: any = {
      ...body,
      tools: functionSchemas,
      stream: true,
    };

    const response = await handleCreateChatCompletions({
      env: ctx.env,
      request: requestParams,
      user,
      anonymousUser,
      isRestricted: ctx.get("isRestricted"),
    });

    return response instanceof Response ? response : ctx.json(response);
  },
);

export default app;
