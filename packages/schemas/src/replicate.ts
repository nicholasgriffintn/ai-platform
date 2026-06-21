import z from "zod/v4";

import { dynamicAppThemeSchema } from "./apps";
import { modelModalitySchema } from "./models";
import { apiResponseSchema } from "./shared";

export const replicateInputFieldSchema = z.object({
	name: z.string(),
	type: z.union([z.string(), z.array(z.string())]),
	description: z.string().optional(),
	required: z.boolean().optional(),
	default: z.unknown().optional(),
	enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const replicateModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	modalities: z
		.object({
			input: z.array(modelModalitySchema),
			output: z.array(modelModalitySchema).optional(),
		})
		.optional(),
	modalitySignature: z.string(),
	modalityLabel: z.string(),
	costPerRun: z.number(),
	inputSchema: z.object({
		fields: z.array(replicateInputFieldSchema),
		reference: z.string().optional(),
	}),
	reference: z.string().optional(),
	category: z.string().optional(),
	icon: z.string().optional(),
	theme: dynamicAppThemeSchema.optional(),
	tags: z.array(z.string()).optional(),
	featured: z.boolean().optional(),
	href: z.string().optional(),
	kind: z.enum(["dynamic", "frontend"]).optional(),
});

export const executeReplicateRequestSchema = z.object({
	modelId: z.string().min(1),
	input: z.record(z.string(), z.unknown()),
});

export const replicatePredictionStatusSchema = z.enum([
	"queued",
	"starting",
	"processing",
	"in_progress",
	"succeeded",
	"completed",
	"failed",
	"canceled",
]);

export const replicatePredictionSchema = z
	.object({
		id: z.union([z.string(), z.number()]).transform(String),
		prediction_id: z.string().optional(),
		status: replicatePredictionStatusSchema,
		output: z.unknown().optional(),
		error: z.string().optional(),
		modelId: z.string(),
		modelName: z.string().optional(),
		input: z.record(z.string(), z.unknown()),
		created_at: z.string().optional(),
		createdAt: z.string().optional(),
		predictionData: z
			.object({
				output: z.unknown().optional(),
				response: z.unknown().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export const replicateModelsResponseSchema = z.object({
	models: z.array(replicateModelSchema),
});

export const replicatePredictionsResponseSchema = z.object({
	predictions: z.array(replicatePredictionSchema),
});

export const replicatePredictionResponseSchema = z.object({
	prediction: replicatePredictionSchema,
});

export const replicateExecuteResponseSchema = z.object({
	response: apiResponseSchema.shape.response.extend({
		data: replicatePredictionSchema,
	}),
});

export const replicatePredictionParamsSchema = z.object({
	id: z.string().min(1),
});

export type ReplicateInputField = z.infer<typeof replicateInputFieldSchema>;
export type ReplicateModel = z.infer<typeof replicateModelSchema>;
export type ExecuteReplicateRequest = z.infer<typeof executeReplicateRequestSchema>;
export type ReplicatePredictionStatus = z.infer<typeof replicatePredictionStatusSchema>;
export type ReplicatePrediction = z.infer<typeof replicatePredictionSchema>;
export type ReplicateModelsResponse = z.infer<typeof replicateModelsResponseSchema>;
export type ReplicatePredictionsResponse = z.infer<typeof replicatePredictionsResponseSchema>;
export type ReplicatePredictionResponse = z.infer<typeof replicatePredictionResponseSchema>;
export type ReplicateExecuteResponse = z.infer<typeof replicateExecuteResponseSchema>;
