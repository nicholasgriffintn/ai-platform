import { Hono } from "hono";
import {
	deployFineTunedModelSchema,
	fineTunedDeploymentParamsSchema,
	fineTunedDeploymentSchema,
	fineTuningJobEventsResponseSchema,
	fineTuningJobParamsSchema,
	fineTuningJobSchema,
	fineTuningModelsResponseSchema,
	startFineTuningJobSchema,
} from "@assistant/schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IEnv } from "~/types";
import {
	deployFineTunedModel,
	getFineTunedDeployment,
	getFineTuningJob,
	listFineTuningJobEvents,
	listFineTuningModels,
	startFineTuningJob,
} from "~/services/training";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("training");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing training route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

addRoute(app, "get", "/models", {
	tags: ["training"],
	summary: "List fine-tunable models",
	description:
		"Lists configured fine-tuning targets. The catalog is provider-aware so adding future providers or Hugging Face checkpoints does not change the route contract.",
	auth: true,
	responses: {
		200: { description: "Configured fine-tuning models", schema: fineTuningModelsResponseSchema },
	},
	handler: async ({ serviceContext }) => ({
		models: await listFineTuningModels(serviceContext),
	}),
});

addRoute(app, "post", "/jobs", {
	tags: ["training"],
	summary: "Start a fine-tuning job",
	description:
		"Starts a provider-backed fine-tuning job. For aws-sagemaker, Hugging Face models run as SageMaker training jobs with S3 training input.",
	auth: true,
	bodySchema: startFineTuningJobSchema,
	responses: {
		200: { description: "Fine-tuning job started", schema: fineTuningJobSchema },
	},
	handler: async ({ serviceContext, body }) => startFineTuningJob(serviceContext, body),
});

addRoute(app, "get", "/jobs/:provider/:jobName", {
	tags: ["training"],
	summary: "Get fine-tuning job status",
	auth: true,
	paramSchema: fineTuningJobParamsSchema,
	responses: {
		200: { description: "Fine-tuning job status", schema: fineTuningJobSchema },
	},
	handler: async ({ serviceContext, params }) =>
		getFineTuningJob(serviceContext, params.provider, params.jobName),
});

addRoute(app, "get", "/jobs/:provider/:jobName/events", {
	tags: ["training"],
	summary: "List fine-tuning job events",
	auth: true,
	paramSchema: fineTuningJobParamsSchema,
	responses: {
		200: { description: "Fine-tuning job events", schema: fineTuningJobEventsResponseSchema },
	},
	handler: async ({ serviceContext, params }) => ({
		events: await listFineTuningJobEvents(serviceContext, params.provider, params.jobName),
	}),
});

addRoute(app, "post", "/deployments", {
	tags: ["training"],
	summary: "Deploy a fine-tuned model",
	description:
		"Creates a provider-backed deployment for fine-tuned model artifacts. For aws-sagemaker, this creates the SageMaker model, endpoint config, and endpoint.",
	auth: true,
	bodySchema: deployFineTunedModelSchema,
	responses: {
		200: { description: "Deployment started", schema: fineTunedDeploymentSchema },
	},
	handler: async ({ serviceContext, body }) => deployFineTunedModel(serviceContext, body),
});

addRoute(app, "get", "/deployments/:provider/:endpointName", {
	tags: ["training"],
	summary: "Get fine-tuned deployment status",
	auth: true,
	paramSchema: fineTunedDeploymentParamsSchema,
	responses: {
		200: { description: "Deployment status", schema: fineTunedDeploymentSchema },
	},
	handler: async ({ serviceContext, params }) =>
		getFineTunedDeployment(serviceContext, params.provider, params.endpointName),
});

export default app;
