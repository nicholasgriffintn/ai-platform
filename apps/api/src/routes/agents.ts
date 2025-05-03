import { MCPClientManager } from "agents/mcp/client";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type z from "zod";

import { allowRestrictedPaths } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requireTurnstileToken } from "~/middleware/turnstile";
import { AgentRepository } from "~/repositories/AgentRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { registerMCPClient } from "~/services/functions/mcp";
import type { IEnv } from "~/types";
import type { ChatCompletionParameters } from "~/types";
import { formatToolCalls } from "../lib/chat/tools";
import { getModelConfigByMatchingModel } from "../lib/models";
import { createAgentSchema, updateAgentSchema } from "./schemas/agents";
import { createChatCompletionsJsonSchema } from "./schemas/chat";
import { apiResponseSchema } from "./schemas/shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("AGENTS");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);
  await allowRestrictedPaths(ctx, next);
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
          console.log("Connecting to server", server);
          const { id } = await mcp.connect(server.url);

          const tools = await mcp.listTools();
          const prompts = await mcp.listPrompts();
          const resources = await mcp.listResources();

          return {
            id,
            connectionState: mcp.mcpConnections[id]?.connectionState,
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
          if (mcp.mcpConnections[id]?.connectionState === "ready") {
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
          }
        } catch (e) {
          console.error("Error connecting to MCP", e);
        }
      }
    } catch (e) {
      console.error("Error getting MCP functions", e);
    }

    const reasoningStepTool = {
      name: "add_reasoning_step",
      description:
        "This tool is to be used for reasoning about the user's request and how to respond to it based on the output of the other tools.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title of the reasoning step",
          },
          content: {
            type: "string",
            description:
              "Your reasoning about what you've learned from previous tool calls and what you plan to do next.",
          },
          nextStep: {
            type: "string",
            enum: ["continue", "finalAnswer"],
            description:
              'Your final tool call MUST set this to "finalAnswer". Use "continue" only if you need additional tool calls.',
          },
        },
        required: ["title", "content", "nextStep"],
      },
    };

    const functionSchemas = [
      reasoningStepTool,
      ...mcpFunctions.map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      })),
    ];

    const modelDetails = getModelConfigByMatchingModel(body.model);
    const formattedTools = formatToolCalls(
      modelDetails.provider,
      functionSchemas,
    );

    const requestParams: any = {
      ...body,
      tools: formattedTools,
      stream: true,
      mode: "agent",
      tool_choice: "required",
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
