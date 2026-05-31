import { Hono } from "hono";
import {
	deployTrainingModelSchema,
	trainingDeploymentDeleteResponseSchema,
	trainingDeploymentParamsSchema,
	trainingDeploymentsResponseSchema,
	trainingDeploymentSchema,
	trainingJobEventsResponseSchema,
	trainingJobParamsSchema,
	trainingJobsResponseSchema,
	trainingJobSchema,
	trainingModelsResponseSchema,
	startTrainingJobSchema,
} from "@assistant/schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IEnv } from "~/types";
import {
	deployTrainingModel,
	deleteTrainingDeployment,
	getTrainingDeployment,
	getTrainingJob,
	listTrainingDeployments,
	listTrainingDeploymentEvents,
	listTrainingJobEvents,
	listTrainingJobs,
	listTrainingModels,
	startTrainingJob,
} from "~/services/training";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("training");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing training route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

addRoute(app, "get", "/models", {
	tags: ["training"],
	summary: "List training models",
	description:
		"Lists configured training targets. The catalog is provider-aware so adding future providers or Hugging Face checkpoints does not change the route contract.",
	auth: true,
	responses: {
		200: { description: "Configured training models", schema: trainingModelsResponseSchema },
	},
	handler: async ({ serviceContext }) => ({
		models: await listTrainingModels(serviceContext),
	}),
});

addRoute(app, "post", "/jobs", {
	tags: ["training"],
	summary: "Start a training job",
	description:
		"Starts a provider-backed training job. For aws-sagemaker, Hugging Face models run as SageMaker training jobs with S3 training input.",
	auth: true,
	bodySchema: startTrainingJobSchema,
	responses: {
		200: { description: "Training job started", schema: trainingJobSchema },
	},
	handler: async ({ serviceContext, body }) => startTrainingJob(serviceContext, body),
});

addRoute(app, "get", "/jobs", {
	tags: ["training"],
	summary: "List training jobs",
	auth: true,
	responses: {
		200: { description: "Training jobs", schema: trainingJobsResponseSchema },
	},
	handler: async ({ serviceContext }) => ({
		jobs: await listTrainingJobs(serviceContext),
	}),
});

addRoute(app, "get", "/jobs/:provider/:jobName", {
	tags: ["training"],
	summary: "Get training job status",
	auth: true,
	paramSchema: trainingJobParamsSchema,
	responses: {
		200: { description: "Training job status", schema: trainingJobSchema },
	},
	handler: async ({ serviceContext, params }) =>
		getTrainingJob(serviceContext, params.provider, params.jobName),
});

addRoute(app, "get", "/jobs/:provider/:jobName/events", {
	tags: ["training"],
	summary: "List training job events",
	auth: true,
	paramSchema: trainingJobParamsSchema,
	responses: {
		200: { description: "Training job events", schema: trainingJobEventsResponseSchema },
	},
	handler: async ({ serviceContext, params }) => ({
		events: await listTrainingJobEvents(serviceContext, params.provider, params.jobName),
	}),
});

addRoute(app, "post", "/deployments", {
	tags: ["training"],
	summary: "Deploy a training model",
	description:
		"Creates a provider-backed deployment. SageMaker targets create an endpoint, while Bedrock import stages Hugging Face model files to S3 when needed and creates a model import job.",
	auth: true,
	bodySchema: deployTrainingModelSchema,
	responses: {
		200: { description: "Deployment started", schema: trainingDeploymentSchema },
	},
	handler: async ({ serviceContext, body }) => deployTrainingModel(serviceContext, body),
});

addRoute(app, "get", "/deployments", {
	tags: ["training"],
	summary: "List training deployments",
	auth: true,
	responses: {
		200: { description: "Training deployments", schema: trainingDeploymentsResponseSchema },
	},
	handler: async ({ serviceContext }) => ({
		deployments: await listTrainingDeployments(serviceContext),
	}),
});

addRoute(app, "get", "/deployments/:provider/:endpointName", {
	tags: ["training"],
	summary: "Get training deployment status",
	auth: true,
	paramSchema: trainingDeploymentParamsSchema,
	responses: {
		200: { description: "Deployment status", schema: trainingDeploymentSchema },
	},
	handler: async ({ serviceContext, params }) =>
		getTrainingDeployment(serviceContext, params.provider, params.endpointName),
});

addRoute(app, "get", "/deployments/:provider/:endpointName/events", {
	tags: ["training"],
	summary: "List training deployment events",
	auth: true,
	paramSchema: trainingDeploymentParamsSchema,
	responses: {
		200: { description: "Training deployment events", schema: trainingJobEventsResponseSchema },
	},
	handler: async ({ serviceContext, params }) => ({
		events: await listTrainingDeploymentEvents(
			serviceContext,
			params.provider,
			params.endpointName,
		),
	}),
});

addRoute(app, "delete", "/deployments/:provider/:endpointName", {
	tags: ["training"],
	summary: "Delete training deployment",
	description:
		"Deletes the provider-backed deployment resources and removes the stored deployment record for the authenticated user.",
	auth: true,
	paramSchema: trainingDeploymentParamsSchema,
	responses: {
		200: {
			description: "Deployment deleted",
			schema: trainingDeploymentDeleteResponseSchema,
		},
	},
	handler: async ({ serviceContext, params }) =>
		deleteTrainingDeployment(serviceContext, params.provider, params.endpointName),
});

export default app;
