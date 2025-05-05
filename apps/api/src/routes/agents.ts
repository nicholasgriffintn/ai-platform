import { MCPClientManager } from "agents/mcp/client";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type z from "zod";

import { formatToolCalls } from "~/lib/chat/tools";
import { getModelConfig } from "~/lib/models";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requireTurnstileToken } from "~/middleware/turnstile";
import { AgentRepository } from "~/repositories/AgentRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { registerMCPClient } from "~/services/functions/mcp";
import { add_reasoning_step } from "~/services/functions/reasoning";
import type { IEnv } from "~/types";
import type { ChatCompletionParameters } from "~/types";
import { createAgentSchema, updateAgentSchema } from "./schemas/agents";
import { createChatCompletionsJsonSchema } from "./schemas/chat";
import { apiResponseSchema } from "./schemas/shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("AGENTS");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["agents"],
    summary: "Get all agents",
    description: "Get all agents for the current user",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  async (ctx: Context) => {
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json({
        status: "success",
        data: [],
      });
    }

    const repo = new AgentRepository(ctx.env);
    const agents = await repo.getAgentsByUser(user.id);

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

app.post(
  "/",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Create an agent",
    description: "Create an agent for the current user",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", createAgentSchema),
  async (ctx: Context) => {
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof createAgentSchema
    >;
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

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
  },
);

app.get(
  "/:agentId",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Get an agent by ID",
    description: "Get an agent by ID",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);

    if (!agent) {
      return ctx.json({ error: "Agent not found" }, 404);
    }

    if (agent.user_id !== user.id) {
      return ctx.json({ error: "Forbidden" }, 403);
    }

    return ctx.json({
      status: "success",
      data: agent,
    });
  },
);

app.get(
  "/:agentId/servers",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Get servers for an agent",
    description: "Get servers for an agent",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);

    if (!agent) {
      return ctx.json({ error: "Agent not found" }, 404);
    }

    if (agent.user_id !== user.id) {
      return ctx.json({ error: "Forbidden" }, 403);
    }

    let servers = [];

    try {
      servers = JSON.parse(agent.servers as string);
    } catch (error) {
      return ctx.json({ error: "Invalid servers" }, 400);
    }

    const mcp = new MCPClientManager(agent.id, "1.0.0");

    const serverDetails = await Promise.all(
      servers.map(
        async (server: {
          url: string;
          type: "sse";
        }) => {
          const { id } = await mcp.connect(server.url);

          const connection = mcp.mcpConnections[id];
          while (connection.connectionState !== "ready") {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          const tools = connection.tools;
          const prompts = connection.prompts;
          const resources = connection.resources;

          return {
            id,
            connectionState: connection.connectionState,
            tools,
            prompts,
            resources,
          };
        },
      ),
    );

    return ctx.json({
      status: "success",
      data: serverDetails,
    });
  },
);

app.put(
  "/:agentId",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Update an agent",
    description: "Update an agent",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", updateAgentSchema),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof updateAgentSchema
    >;
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);

    if (!agent) {
      return ctx.json({ error: "Agent not found" }, 404);
    }

    if (agent.user_id !== user.id) {
      return ctx.json({ error: "Forbidden" }, 403);
    }

    await repo.updateAgent(agentId, body);

    return ctx.json({
      status: "success",
      data: agent,
    });
  },
);

app.delete(
  "/:agentId",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Delete an agent",
    description: "Delete an agent",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new AgentRepository(ctx.env);
    const agent = await repo.getAgentById(agentId);

    if (!agent) {
      return ctx.json({ error: "Agent not found" }, 404);
    }

    if (agent.user_id !== user.id) {
      return ctx.json({ error: "Forbidden" }, 403);
    }

    await repo.deleteAgent(agentId);
    return ctx.json({
      status: "success",
    });
  },
);

app.post(
  "/:agentId/completions",
  describeRoute({
    tags: ["agents"],
    summary: "Create a completion for an agent",
    description: "Create a completion for an agent",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  requireTurnstileToken,
  zValidator("json", createChatCompletionsJsonSchema),
  async (ctx: Context) => {
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");
    const anonymousUser = ctx.get("anonymousUser");

    if (!user && !anonymousUser) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

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

    let mcp: MCPClientManager | null = null;

    try {
      const serversJson = agent.servers as string;

      const serverConfigs = JSON.parse(serversJson) as Array<{ url: string }>;
      mcp = new MCPClientManager(agent.id, "1.0.0");

      registerMCPClient(agent.id, mcp);

      for (const cfg of serverConfigs) {
        try {
          const { id } = await mcp.connect(cfg.url);
          const connection = mcp.mcpConnections[id];
          while (connection.connectionState !== "ready") {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          const rawTools = (await mcp.unstable_getAITools()) as any;

          const defs = Object.entries(rawTools) as [string, any][];

          for (const [name, def] of defs) {
            const shortAgentId = agent.id.substring(0, 8);
            const toolName = `mcp_${shortAgentId}_${name}`;

            mcpFunctions.push({
              name: toolName,
              description: def.description as string,
              parameters: def.parameters as Record<string, any>,
            });
          }
        } catch (e) {
          console.error("Error connecting to MCP", e);
        }
      }
    } catch (e) {
      console.error("Error getting MCP functions", e);
    }

    const functionSchemas = [
      {
        name: add_reasoning_step.name,
        description: add_reasoning_step.description,
        parameters: add_reasoning_step.parameters,
      },
      ...mcpFunctions.map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      })),
    ];

    const modelDetails = getModelConfig(body.model);
    if (!modelDetails) {
      return ctx.json(
        {
          status: "error",
          error: "Invalid model",
        },
        400,
      );
    }
    const formattedTools = formatToolCalls(
      modelDetails.provider,
      functionSchemas,
    );

    const requestParams: ChatCompletionParameters = {
      ...body,
      tools: formattedTools,
      stream: true,
      mode: "agent",
      max_steps: 20,
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
