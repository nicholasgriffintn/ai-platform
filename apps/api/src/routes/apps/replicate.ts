import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import z from "zod/v4";
import { apiResponseSchema } from "@assistant/schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import { listReplicatePredictions } from "~/services/apps/replicate/list";
import { getReplicatePredictionDetails } from "~/services/apps/replicate/get-details";
import { replicateModelConfig } from "~/data-model/models/replicate";
import type { AppTheme } from "~/types/app-schema";
import type { ModelModalities, ModelModality } from "~/types";
import { AssistantError } from "~/utils/errors";

const signatureMetadata: Record<
	string,
	{
		category: string;
		icon: string;
		theme: AppTheme;
	}
> = {
	"text->image": {
		category: "Image Generation",
		icon: "image",
		theme: "pink",
	},
	"image->image": {
		category: "Image Editing",
		icon: "sparkles",
		theme: "violet",
	},
	"text->video": {
		category: "Video Generation",
		icon: "video",
		theme: "rose",
	},
	"image->video": {
		category: "Video Generation",
		icon: "video",
		theme: "rose",
	},
	"text->audio": {
		category: "Audio Generation",
		icon: "music",
		theme: "indigo",
	},
	"audio->text": {
		category: "Transcription",
		icon: "mic",
		theme: "emerald",
	},
};

const replicateModelMetadata: Record<
	string,
	Partial<{
		category: string;
		icon: string;
		theme: AppTheme;
		tags: string[];
		featured: boolean;
	}>
> = {
	"replicate-google-nano-banana-pro": {
		featured: true,
		tags: ["image", "editing", "google"],
	},
	"replicate-bytedance-sdxl-lightning-4step": {
		featured: true,
		tags: ["image", "editing", "bytedance"],
	},
	"replicate-sora-2": {
		featured: true,
		tags: ["video"],
	},
	"replicate-veo-3-1": {
		featured: true,
		tags: ["video"],
	},
	"replicate-stable-audio": {
		featured: true,
		tags: ["audio", "composition"],
	},
};

const DEFAULT_CATEGORY = "Creative Tools";
const DEFAULT_ICON = "sparkles";
const DEFAULT_THEME: AppTheme = "slate";

function getModalitySignature(modalities?: ModelModalities) {
	const input = (modalities?.input ?? ["text"]) as ModelModality[];
	const output = (modalities?.output ?? ["text"]) as ModelModality[];
	const signature = `${input.join("+")}->${output.join("+")}`;
	const label = `${input.join(" & ")} \u2192 ${output.join(" & ")}`;

	return { signature, label };
}

const app = new Hono();

const routeLogger = createRouteLogger("apps/replicate");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing replicate route: ${c.req.path}`);
	return next();
});

const executeReplicateSchema = z.object({
	modelId: z.string().min(1),
	input: z.record(z.string(), z.any()),
});

const predictionParamsSchema = z.object({
	id: z.string().min(1),
});

addRoute(app, "get", "/models", {
	tags: ["apps"],
	description: "List all available Replicate models",
	responses: {
		200: { description: "List of Replicate models", schema: z.array(z.any()) },
	},
	handler: async () => {
		const models = Object.entries(replicateModelConfig).map(([id, model]) => {
			const metadata = replicateModelMetadata[id] || {};
			const { signature, label } = getModalitySignature(model.modalities);
			const signatureDefaults = signatureMetadata[signature] || null;

			const category =
				metadata.category || signatureDefaults?.category || (DEFAULT_CATEGORY as string);
			const icon = metadata.icon || signatureDefaults?.icon || DEFAULT_ICON;
			const theme = metadata.theme || signatureDefaults?.theme || DEFAULT_THEME;
			const tags = Array.from(
				new Set([label, ...(model.strengths ?? []), ...(metadata.tags ?? [])]),
			);

			return {
				id,
				name: model.name,
				description: model.description,
				modalities: model.modalities,
				modalitySignature: signature,
				modalityLabel: label,
				costPerRun: model.costPerRun,
				inputSchema: model.inputSchema,
				reference: model.inputSchema?.reference,
				category,
				icon,
				theme,
				tags,
				featured: metadata.featured ?? false,
				href: `/apps/replicate/${id}`,
				kind: "frontend" as const,
			};
		});

		return { models };
	},
});

addRoute(app, "get", "/predictions", {
	tags: ["apps"],
	description: "List user's Replicate predictions",
	responses: {
		200: { description: "List of predictions", schema: z.any() },
	},
	auth: true,
	handler: async ({ serviceContext, user }) => {
		try {
			const predictions = await listReplicatePredictions({
				context: serviceContext,
				userId: user.id,
			});

			return { predictions };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error fetching predictions:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch predictions");
		}
	},
});

addRoute(app, "get", "/predictions/:id", {
	tags: ["apps"],
	description: "Get Replicate prediction details",
	paramSchema: predictionParamsSchema,
	responses: {
		200: { description: "Prediction details", schema: z.any() },
	},
	auth: true,
	handler: async ({ params, serviceContext, user }) => {
		try {
			const prediction = await getReplicatePredictionDetails({
				context: serviceContext,
				predictionId: params.id,
				userId: user.id,
			});

			return { prediction };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error fetching prediction:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to fetch prediction");
		}
	},
});

addRoute(app, "post", "/execute", {
	tags: ["apps"],
	description: "Execute a Replicate model",
	bodySchema: executeReplicateSchema,
	responses: {
		200: { description: "Execution result", schema: apiResponseSchema },
	},
	auth: true,
	handler: async ({ body, serviceContext, user }) => {
		try {
			const result = await executeReplicateModel({
				context: serviceContext,
				params: body,
				user,
			});

			return { response: result };
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			routeLogger.error("Error executing model:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			throw new AssistantError("Failed to execute model");
		}
	},
});

export default app;
