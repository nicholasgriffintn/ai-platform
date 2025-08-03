import { MCPClientManager } from "agents/mcp/client";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type z from "zod";

import { formatToolCalls } from "~/lib/chat/tools";
import { getModelConfig } from "~/lib/models";
import { requireAuth } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { AgentRepository } from "~/repositories/AgentRepository";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { registerMCPClient } from "~/services/functions/mcp";
import { add_reasoning_step } from "~/services/functions/reasoning";
import {
  delegateToTeamMember,
  delegateToTeamMemberByRole,
  getTeamMembers,
} from "~/services/functions/teamDelegation";
import type { IEnv } from "~/types";
import type { ChatCompletionParameters } from "~/types";
import { createAgentSchema, updateAgentSchema } from "../schemas/agents";
import { createChatCompletionsJsonSchema } from "../schemas/chat";
import { apiResponseSchema } from "../schemas/shared";
import sharedAgents from "./shared";

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
      body.servers ?? [],
      body.model,
      body.temperature,
      body.max_steps,
      body.system_prompt,
      body.few_shot_examples,
      body.team_id,
      body.team_role,
      body.is_team_agent,
    );

    return ctx.json({
      status: "success",
      data: agent,
    });
  },
);

app.get(
  "/teams",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Get team agents",
    description: "Get all team agents for the current user",
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
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new AgentRepository(ctx.env);
    const agents = await repo.getTeamAgents(user.id);

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

app.get(
  "/teams/:teamId",
  requireAuth,
  describeRoute({
    tags: ["agents"],
    summary: "Get agents by team ID",
    description:
      "Get all agents belonging to a specific team for the current user",
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
    const { teamId } = ctx.req.param();
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
    const agents = await repo.getAgentsByTeamAndUser(teamId, user.id);

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

app.route("/shared", sharedAgents);

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
  validateCaptcha,
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

    if (agent.servers) {
      try {
        const serversJson = agent.servers as string;
        let serverConfigs = [];
        try {
          serverConfigs = JSON.parse(serversJson) as Array<{ url: string }>;
        } catch (e) {
          throw new Error("Invalid servers");
        }

        if (serverConfigs && serverConfigs.length > 0) {
          mcp = new MCPClientManager(agent.id, "1.0.0");
          registerMCPClient(agent.id, mcp);

          for (const cfg of serverConfigs) {
            try {
              const { id } = await mcp.connect(cfg.url);

              if (!id) {
                logger.error("No ID returned from MCP connect");
                continue;
              }

              const connection = mcp.mcpConnections[id];

              if (!connection?.connectionState) {
                logger.error("No connection found for ID:", id);
                continue;
              }

              while (connection.connectionState !== "ready") {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              const rawTools = (await mcp.unstable_getAITools()) as any;

              const defs = Object.entries(rawTools) as [string, any][];

              for (const [name, def] of defs) {
                const shortAgentId = agent.id.substring(0, 8);
                const toolName = `mcp_${shortAgentId}_${name}`;

                if (
                  !def.parameters ||
                  (!def.parameters.properties &&
                    !def.parameters.jsonSchema.properties)
                ) {
                  continue;
                }

                mcpFunctions.push({
                  name: toolName,
                  description: def.description as string,
                  parameters: def.parameters as Record<string, any>,
                });
              }
            } catch (e) {
              logger.error("Error connecting to MCP", {
                error_message: e instanceof Error ? e.message : "Unknown error",
              });
            }
          }
        }
      } catch (e) {
        logger.error("Error getting MCP functions", {
          error_message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const teamDelegationTools =
      agent.team_role === "orchestrator"
        ? [
            {
              name: delegateToTeamMember.name,
              description: delegateToTeamMember.description,
              parameters: delegateToTeamMember.parameters,
            },
            {
              name: delegateToTeamMemberByRole.name,
              description: delegateToTeamMemberByRole.description,
              parameters: delegateToTeamMemberByRole.parameters,
            },
            {
              name: getTeamMembers.name,
              description: getTeamMembers.description,
              parameters: getTeamMembers.parameters,
            },
          ]
        : [];

    const functionSchemas = [
      {
        name: add_reasoning_step.name,
        description: add_reasoning_step.description,
        parameters: add_reasoning_step.parameters,
      },
      ...teamDelegationTools,
      ...mcpFunctions.map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      })),
    ];

    const modelToUse = agent.model || body.model;
    const modelDetails = await getModelConfig(modelToUse);
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

    let fewShotExamples = undefined;
    if (agent.few_shot_examples) {
      try {
        const rawFewShotExamples = JSON.parse(
          agent.few_shot_examples as string,
        );

        fewShotExamples = `
          Examples:
          ${rawFewShotExamples
            .map(
              (example: { input: string; output: string }) => `
            User: ${example.input}
            Assistant: ${example.output}
          `,
            )
            .join("\n")}
        `;
      } catch (e) {
        logger.error("Error parsing few-shot examples", {
          error_message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    let systemPrompt = agent.system_prompt;

    if (fewShotExamples) {
      systemPrompt = `${systemPrompt}\n\n${fewShotExamples}`;
    }

    const requestParams: ChatCompletionParameters = {
      ...body,
      system_prompt: systemPrompt,
      model: modelToUse,
      tools: formattedTools,
      stream: true,
      mode: "agent",
      max_steps: agent.max_steps || body.max_steps || 20,
      temperature:
        Number.parseFloat(agent.temperature) || body.temperature || 0.8,
      current_agent_id: agentId,
    };

    const response = await handleCreateChatCompletions({
      env: ctx.env,
      request: requestParams,
      user,
      anonymousUser,
    });

    return response instanceof Response ? response : ctx.json(response);
  },
);

export default app;
