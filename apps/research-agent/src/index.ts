import { getRandom } from "@cloudflare/containers";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { timeout } from "hono/timeout";
import * as v from "valibot";

import { ResearchOrchestrator } from "./core/research-orchestrator.js";
import { ContainerizedNLPPlugin } from "./plugins/containerized-nlp-plugin.js";
import { ContainerizedWebPlugin } from "./plugins/containerized-web-plugin.js";
import type { ResearchQuery } from "./types/core.js";

type HonoConfig = {
  Bindings: CloudflareBindings & {
    NLP_AGENT: DurableObjectNamespace;
    WEB_AGENT: DurableObjectNamespace;
  };
};

const app = new Hono<HonoConfig>();

const researchQuerySchema = v.object({
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  context: v.optional(v.string()),
  parameters: v.object({
    depth: v.picklist(["shallow", "medium", "deep"]),
    sources: v.object({
      maxSources: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(50),
      ),
      sourceTypes: v.array(
        v.picklist(["web", "academic", "news", "social", "patent", "legal"]),
      ),
      languages: v.optional(v.array(v.string())),
      dateRange: v.optional(
        v.object({
          from: v.optional(v.string()),
          to: v.optional(v.string()),
        }),
      ),
      domains: v.optional(
        v.object({
          include: v.optional(v.array(v.string())),
          exclude: v.optional(v.array(v.string())),
        }),
      ),
    }),
    analysis: v.object({
      enableSentiment: v.boolean(),
      enableEntities: v.boolean(),
      enableSummarization: v.boolean(),
      enableFactChecking: v.boolean(),
      enableTrends: v.boolean(),
      customAnalyzers: v.optional(v.array(v.string())),
    }),
    output: v.object({
      format: v.picklist(["structured", "narrative", "hybrid"]),
      includeSourceMaterial: v.boolean(),
      confidenceThreshold: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
      maxLength: v.optional(v.pipe(v.number(), v.integer(), v.minValue(100))),
    }),
  }),
  metadata: v.object({
    priority: v.picklist(["low", "normal", "high", "urgent"]),
    timeout: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(30000),
      v.maxValue(1800000),
    ),
    tags: v.optional(v.array(v.string())),
  }),
});

let orchestrator: ResearchOrchestrator;

function initializeOrchestrator(
  env?: HonoConfig["Bindings"],
): ResearchOrchestrator {
  if (!orchestrator) {
    orchestrator = new ResearchOrchestrator({
      maxConcurrentStages: 5,
      defaultTimeout: 300000,
    });

    // Register containerized plugins if environment is available
    if (env?.NLP_AGENT && env?.WEB_AGENT) {
      try {
        // Get container instances
        const nlpContainer = getRandom(env.NLP_AGENT);
        const webContainer = getRandom(env.WEB_AGENT);

        orchestrator.registerPlugin(new ContainerizedNLPPlugin(nlpContainer));
        orchestrator.registerPlugin(new ContainerizedWebPlugin(webContainer));

        console.log("Containerized plugins registered successfully");
      } catch (error) {
        console.error("Failed to register containerized plugins:", error);
        throw new Error(
          "Containerized plugins are required but failed to initialize",
        );
      }
    } else {
      throw new Error(
        "Container bindings (NLP_AGENT, WEB_AGENT) are required but not available",
      );
    }
  }
  return orchestrator;
}

app.get("/", (c) => {
  return c.env.ASSETS.fetch(c.req);
});

app.get("/docs", (c) => {
  return c.json({
    name: "Advanced Research Agent",
    version: "2.0.0",
    description:
      "Next-generation AI research orchestrator with plugin-based architecture",
    architecture: {
      core: "Plugin-based execution engine",
      features: [
        "Dynamic execution planning",
        "Parallel stage processing",
        "Advanced error recovery",
        "Comprehensive reporting",
        "Real-time monitoring",
      ],
    },
    endpoints: {
      "GET /": "API information",
      "GET /health": "System health and status",
      "GET /plugins": "Available plugins and capabilities",
      "POST /research": "Conduct comprehensive research",
      "GET /research/{id}/status": "Check research progress",
      "DELETE /research/{id}": "Cancel active research",
      "GET /metrics": "System performance metrics",
    },
  });
});

app.get("/health", async (c) => {
  try {
    const researchAgent = initializeOrchestrator(c.env);
    const status = await researchAgent.getSystemStatus();

    const statusCode =
      status.status === "healthy"
        ? 200
        : status.status === "degraded"
          ? 206
          : 503;

    return c.json(status, statusCode);
  } catch (error: any) {
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      503,
    );
  }
});

app.get("/plugins", (c) => {
  const researchAgent = initializeOrchestrator(c.env);
  const plugins = researchAgent.getRegisteredPlugins();

  return c.json({
    totalPlugins: plugins.length,
    plugins: plugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      type: plugin.type,
      capabilities: plugin.capabilities.map((cap) => cap.name),
      author: plugin.author,
    })),
  });
});

app.get("/metrics", async (c) => {
  const researchAgent = initializeOrchestrator(c.env);
  const status = await researchAgent.getSystemStatus();

  return c.json({
    performance: status.metrics,
    uptime: status.uptime,
    activeExecutions: researchAgent.getActiveExecutions().length,
    timestamp: new Date().toISOString(),
  });
});

app.use("/research", async (c, next) => {
  if (c.req.method === "POST") {
    const tenMinutesMs = 600 * 1000;

    return await timeout(
      tenMinutesMs,
      new HTTPException(408, {
        res: Response.json({
          success: false,
          error: "REQUEST_TIMEOUT",
          message:
            "Research request exceeded maximum processing time of 10 minutes",
          timestamp: new Date().toISOString(),
        }),
      }),
    )(c, next);
  }

  return await next();
});

app.post("/research", sValidator("json", researchQuerySchema), async (c) => {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  try {
    const requestData = c.req.valid("json");
    const researchAgent = initializeOrchestrator(c.env);

    const query: ResearchQuery = {
      id: requestId,
      query: requestData.query,
      context: requestData.context,
      parameters: requestData.parameters,
      metadata: {
        requestId,
        priority: requestData.metadata.priority,
        timeout: requestData.metadata.timeout,
        createdAt: new Date().toISOString(),
        tags: requestData.metadata.tags,
      },
    };

    const report = await researchAgent.conductResearch(query);
    const processingTime = performance.now() - startTime;

    return c.json({
      success: true,
      requestId,
      processingTime: Math.round(processingTime),
      report,
    });
  } catch (error: any) {
    const processingTime = performance.now() - startTime;

    console.error("Research request failed:", {
      requestId,
      error: error.message,
      processingTime: Math.round(processingTime),
    });

    const isResearchError =
      error.code && error.message && typeof error.retryable === "boolean";

    return c.json(
      {
        success: false,
        requestId,
        processingTime: Math.round(processingTime),
        error: {
          code: isResearchError ? error.code : "INTERNAL_ERROR",
          message: isResearchError
            ? error.message
            : "An unexpected error occurred during research",
          retryable: isResearchError ? error.retryable : false,
          details: isResearchError ? error.details : undefined,
        },
      },
      500,
    );
  }
});

app.get("/research/:id/status", (c) => {
  const planId = c.req.param("id");
  const researchAgent = initializeOrchestrator(c.env);

  const status = researchAgent.getActiveExecutions().includes(planId)
    ? "running"
    : "not_found";

  return c.json({
    planId,
    status,
    timestamp: new Date().toISOString(),
  });
});

app.delete("/research/:id", async (c) => {
  const planId = c.req.param("id");
  const researchAgent = initializeOrchestrator(c.env);

  const cancelled = await researchAgent.cancelResearch(planId);

  if (cancelled) {
    return c.json({
      success: true,
      message: `Research ${planId} has been cancelled`,
      timestamp: new Date().toISOString(),
    });
  }
  return c.json(
    {
      success: false,
      message: `Research ${planId} not found or already completed`,
      timestamp: new Date().toISOString(),
    },
    404,
  );
});

app.get("/templates", (c) => {
  return c.json({
    templates: [
      {
        name: "Quick Research",
        description: "Fast web search with basic analysis",
        parameters: {
          depth: "shallow",
          sources: {
            maxSources: 5,
            sourceTypes: ["web"],
          },
          analysis: {
            enableSentiment: false,
            enableEntities: false,
            enableSummarization: true,
            enableFactChecking: false,
            enableTrends: false,
          },
          output: {
            format: "structured",
            includeSourceMaterial: false,
            confidenceThreshold: 0.6,
          },
        },
      },
      {
        name: "Comprehensive Analysis",
        description: "Deep research with full analysis suite",
        parameters: {
          depth: "deep",
          sources: {
            maxSources: 20,
            sourceTypes: ["web", "news", "academic"],
          },
          analysis: {
            enableSentiment: true,
            enableEntities: true,
            enableSummarization: true,
            enableFactChecking: true,
            enableTrends: true,
          },
          output: {
            format: "hybrid",
            includeSourceMaterial: true,
            confidenceThreshold: 0.7,
          },
        },
      },
    ],
  });
});

app.onError((err, c) => {
  console.error("Application error:", {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json(
    {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "ENDPOINT_NOT_FOUND",
      message: `Endpoint ${c.req.method} ${c.req.path} not found`,
      availableEndpoints: [
        "GET /",
        "GET /health",
        "GET /plugins",
        "POST /research",
        "GET /research/{id}/status",
        "DELETE /research/{id}",
        "GET /metrics",
        "GET /templates",
      ],
      timestamp: new Date().toISOString(),
    },
    404,
  );
});

export default app;

export * from "./types/core.js";
export { NLPAgent, WebAgent } from "./containers/container-definitions.js";
export { ContainerizedNLPPlugin } from "./plugins/containerized-nlp-plugin.js";
export { ContainerizedWebPlugin } from "./plugins/containerized-web-plugin.js";
