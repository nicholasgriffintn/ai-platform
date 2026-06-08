import z from "zod/v4";

import { appDataSchema } from "./app-data";

export const insertEmbeddingSchema = z.object({
	type: z.string(),
	content: z.string().optional(),
	file: z
		.object({
			data: z.any(),
			mimeType: z.string(),
		})
		.optional(),
	id: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	title: z.string().optional(),
	rag_options: z
		.object({
			namespace: z.string().optional(),
		})
		.optional(),
});

export const queryEmbeddingsSchema = z.object({
	query: z.string(),
	namespace: z.string().optional(),
	type: z.string().optional(),
});

export const deleteEmbeddingSchema = z.object({
	ids: z.array(z.string()),
});

export const weatherQuerySchema = z.object({
	longitude: z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a valid number"),
	latitude: z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a valid number"),
});

export const imageGenerationSchema = z.object({
	prompt: z.string(),
	image_style: z.enum([
		"default",
		"art-deco",
		"cinematic",
		"cyberpunk",
		"fantasy",
		"graffiti",
		"impressionist",
		"minimal",
		"moody",
		"noir",
		"pop-art",
		"retro",
		"surreal",
		"vaporwave",
		"vibrant",
		"watercolor",
	]),
	steps: z.number().optional(),
});

export const videoGenerationSchema = z.object({
	prompt: z.string(),
	negative_prompt: z.string().optional(),
	guidance_scale: z.number().optional(),
	video_length: z.number().optional(),
	height: z.number().optional(),
	width: z.number().optional(),
});

export const musicGenerationSchema = z.object({
	prompt: z.string(),
	input_audio: z.string().optional(),
	duration: z.number().optional(),
});

export const drawingSchema = z.object({
	drawing: z.any().refine((file) => file && file instanceof File, {
		error: "Drawing must be a valid file",
	}),
	drawingId: z.string().optional(),
});

export const guessDrawingSchema = z.object({
	drawing: z.any().refine((file) => file && file instanceof File, {
		error: "Drawing must be a valid file",
	}),
});

export const podcastTranscribeSchema = z.object({
	podcastId: z.string(),
	numberOfSpeakers: z.number(),
	prompt: z.string(),
});

export const podcastSummarizeSchema = z.object({
	podcastId: z.string(),
	speakers: z.record(z.string(), z.string()),
});

export const podcastGenerateImageSchema = z.object({
	podcastId: z.string(),
	prompt: z.string().optional(),
});

export const articleAnalyzeSchema = z.object({
	article: z.string(),
	itemId: z.string(),
});

export const articleSummariseSchema = z.object({
	article: z.string(),
	itemId: z.string(),
});

export const generateArticlesReportSchema = z.object({
	itemId: z.string(),
});

export const contentExtractSchema = z.object({
	urls: z.array(z.url()),
	extract_depth: z.enum(["basic", "advanced"]).optional(),
	include_images: z.boolean().optional(),
	should_vectorize: z.boolean().optional(),
	namespace: z.string().optional(),
	provider: z.enum(["auto", "tavily", "cloudflare"]).optional(),
	cloudflareFormat: z
		.enum(["markdown", "content", "json", "links", "scrape", "snapshot"])
		.optional(),
	cloudflareJsonOptions: z.record(z.string(), z.unknown()).optional(),
	cloudflareScrapeOptions: z
		.object({
			elements: z.array(
				z.object({
					selector: z.string(),
					name: z.string().optional(),
					attribute: z.string().optional(),
				}),
			),
		})
		.optional(),
	cloudflareCrawlOptions: z
		.object({
			enabled: z.boolean().optional(),
			limit: z.number().optional(),
			depth: z.number().optional(),
			source: z.enum(["all", "sitemaps", "links"]).optional(),
			formats: z.array(z.enum(["html", "markdown", "json"])).optional(),
			render: z.boolean().optional(),
			maxAge: z.number().optional(),
			modifiedSince: z.number().optional(),
			options: z
				.object({
					includeExternalLinks: z.boolean().optional(),
					includeSubdomains: z.boolean().optional(),
					includePatterns: z.array(z.string()).optional(),
					excludePatterns: z.array(z.string()).optional(),
				})
				.optional(),
			pollIntervalMs: z.number().optional(),
			maxPollAttempts: z.number().optional(),
		})
		.optional(),
});

export const captureScreenshotSchema = z.object({
	url: z.string().optional(),
	html: z.string().optional(),
	screenshotOptions: z
		.object({
			omitBackground: z.boolean().optional(),
			fullPage: z.boolean().optional(),
		})
		.optional(),
	viewport: z
		.object({
			width: z.number().optional(),
			height: z.number().optional(),
		})
		.optional(),
	gotoOptions: z
		.object({
			waitUntil: z.enum(["domcontentloaded", "networkidle0"]).optional(),
			timeout: z.number().optional(),
		})
		.optional(),
	addScriptTag: z
		.array(
			z.object({
				url: z.string().optional(),
				content: z.string().optional(),
			}),
		)
		.optional(),
	addStyleTag: z
		.array(
			z.object({
				url: z.string().optional(),
				content: z.string().optional(),
			}),
		)
		.optional(),
});

export const ocrSchema = z.object({
	provider: z.enum(["mistral"]).optional(),
	model: z.enum(["mistral-ocr-latest"]).optional(),
	document: z.object({
		type: z.enum(["document_url"]).optional(),
		document_url: z.string(),
		document_name: z.string().optional(),
	}),
	id: z.string().optional(),
	pages: z.array(z.number()).optional().meta({
		description:
			"Specific pages user wants to process in various formats: single number, range, or list of both. Starts from 0",
	}),
	include_image_base64: z.boolean().optional().meta({
		description: "Whether to include the images in a base64 format in the response",
	}),
	image_limit: z.number().optional().meta({
		description: "Limit the number of images to extract",
	}),
	image_min_size: z.number().optional().meta({
		description: "Minimum height and width of image to extract",
	}),
	output_format: z.enum(["json", "html", "markdown"]).optional().meta({
		description: "Output format of the response",
	}),
});

export const speechGenerationSchema = z.object({
	prompt: z.string(),
	lang: z.string().optional(),
});

export const deepWebSearchSchema = z.object({
	searchProvider: z.string().optional(),
	query: z.string(),
	options: z
		.object({
			search_depth: z.enum(["basic", "advanced"]).optional(),
			include_answer: z.boolean().optional(),
			include_raw_content: z.boolean().optional(),
			include_images: z.boolean().optional(),
		})
		.optional(),
});

export const deepResearchSchema = z.object({
	provider: z.string().optional(),
	input: z.union([z.string(), z.record(z.string(), z.unknown())]),
	wait_for_completion: z.boolean().optional(),
	options: z
		.object({
			processor: z.string().optional(),
			enable_events: z.boolean().optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
			task_spec: z
				.object({
					input_schema: z.any().optional(),
					output_schema: z
						.object({
							type: z.enum(["json", "text", "auto"]),
							json_schema: z.any().optional(),
							description: z.string().optional(),
						})
						.optional(),
				})
				.optional(),
			polling: z
				.object({
					interval_ms: z.number().int().positive().optional(),
					max_attempts: z.number().int().positive().optional(),
					timeout_seconds: z.number().int().positive().optional(),
				})
				.optional(),
		})
		.optional(),
});

export const tutorSchema = z.object({
	topic: z.string(),
	level: z.enum(["beginner", "intermediate", "advanced"]).prefault("advanced").optional(),
	options: z
		.object({
			search_depth: z.enum(["basic", "advanced"]).optional(),
			include_answer: z.boolean().optional(),
			include_raw_content: z.boolean().optional(),
			include_images: z.boolean().optional(),
		})
		.optional(),
});

export const promptCoachJsonSchema = z.object({
	prompt: z.string().describe("The user's prompt to get suggestions for."),
	promptType: z
		.enum(["general", "creative", "technical", "instructional", "analytical"])
		.optional()
		.describe("The type of prompt to get suggestions for."),
	recursionDepth: z
		.number()
		.optional()
		.describe("The depth of the recursion for the prompt coach."),
});

export const promptCoachResponseSchema = z.object({
	suggested_prompt: z
		.string()
		.nullable()
		.describe("The suggested improvement for the user's prompt."),
});

export const appInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	icon: z.string().optional(),
	category: z.string().optional(),
	theme: z
		.enum(["violet", "indigo", "pink", "rose", "cyan", "emerald", "amber", "sky", "slate", "blue"])
		.optional(),
	tags: z.array(z.string()).optional(),
	featured: z.boolean().optional(),
	costPerCall: z.number().optional(),
	isDefault: z.boolean().optional(),
	type: z.enum(["normal", "premium", "byok"]).optional(),
	href: z.string().optional(),
	kind: z.enum(["dynamic", "frontend"]).optional(),
});

export const appInfoArraySchema = z.array(appInfoSchema);

export const dynamicAppThemes = [
	"violet",
	"indigo",
	"pink",
	"rose",
	"cyan",
	"emerald",
	"amber",
	"sky",
	"slate",
	"blue",
] as const;

export const dynamicAppFieldTypes = [
	"text",
	"number",
	"select",
	"multiselect",
	"checkbox",
	"file",
	"date",
	"textarea",
] as const;

export const dynamicAppResponseDisplayTypes = [
	"table",
	"json",
	"text",
	"template",
	"custom",
] as const;

export const FieldType = {
	TEXT: "text",
	NUMBER: "number",
	SELECT: "select",
	MULTISELECT: "multiselect",
	CHECKBOX: "checkbox",
	FILE: "file",
	DATE: "date",
	TEXTAREA: "textarea",
} satisfies Record<string, (typeof dynamicAppFieldTypes)[number]>;

export const dynamicAppThemeSchema = z.enum(dynamicAppThemes);
export const dynamicAppFieldTypeSchema = z.enum(dynamicAppFieldTypes);
export const dynamicAppResponseDisplayTypeSchema = z.enum(dynamicAppResponseDisplayTypes);

export const dynamicAppFormFieldSchema = z.object({
	id: z.string(),
	type: dynamicAppFieldTypeSchema,
	label: z.string(),
	description: z.string().optional(),
	placeholder: z.string().optional(),
	required: z.boolean(),
	defaultValue: z.unknown().optional(),
	validation: z
		.object({
			pattern: z.string().optional(),
			min: z.number().optional(),
			max: z.number().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			options: z
				.array(
					z.object({
						label: z.string(),
						value: z.string(),
					}),
				)
				.optional(),
		})
		.optional(),
});

export const dynamicAppFormStepSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	fields: z.array(dynamicAppFormFieldSchema),
});

export const dynamicAppFormSchema = z.object({
	steps: z.array(dynamicAppFormStepSchema),
});

export const dynamicAppResponseFieldSchema = z.object({
	key: z.string(),
	label: z.string(),
	format: z.string().optional(),
});

export const dynamicAppResponseDisplaySchema = z.object({
	fields: z.array(dynamicAppResponseFieldSchema).optional(),
	template: z.string().optional(),
});

export const dynamicAppResponseSchema = z.object({
	type: dynamicAppResponseDisplayTypeSchema,
	display: dynamicAppResponseDisplaySchema,
});

export const dynamicAppSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	icon: z.string().optional(),
	category: z.string().optional(),
	theme: dynamicAppThemeSchema.optional(),
	tags: z.array(z.string()).optional(),
	featured: z.boolean().optional(),
	costPerCall: z.number().optional(),
	isDefault: z.boolean().optional(),
	type: z.enum(["normal", "premium", "byok"]).optional(),
	kind: z.enum(["dynamic", "frontend"]).optional(),
	formSchema: dynamicAppFormSchema,
	responseSchema: dynamicAppResponseSchema,
});

export const dynamicAppsResponseSchema = z.object({
	apps: appInfoArraySchema,
});

export const dynamicAppIdParamSchema = z.object({ id: z.string() });

export const dynamicAppExecuteRequestSchema = z.record(z.string(), z.any());

export const dynamicAppErrorResponseSchema = z.object({
	error: z.string(),
	message: z.string().optional(),
});

export const dynamicAppExecutionUnauthorizedResponseSchema = z.object({
	response: z.object({
		status: z.literal("error"),
		message: z.string(),
	}),
});

export const dynamicAppExecutionResponseSchema = z.object({
	success: z.boolean(),
	response_id: z.string().optional(),
	data: z.object({
		message: z.string(),
		timestamp: z.iso.datetime(),
		input: z.record(z.string(), z.unknown()),
		result: z.unknown(),
	}),
});

export const dynamicAppStoredResponsesResponseSchema = z.array(appDataSchema);

export const dynamicAppStoredResponseResponseSchema = z.object({
	response: z.any(),
});

export type AppTheme = z.infer<typeof dynamicAppThemeSchema>;
export type AppKind = "dynamic" | "frontend";
export type FieldType = z.infer<typeof dynamicAppFieldTypeSchema>;
export type DynamicAppFormField = z.infer<typeof dynamicAppFormFieldSchema>;
export type DynamicAppFormStep = z.infer<typeof dynamicAppFormStepSchema>;
export type DynamicAppFormSchema = z.infer<typeof dynamicAppFormSchema>;
export type DynamicAppResponseField = z.infer<typeof dynamicAppResponseFieldSchema>;
export type DynamicAppResponseDisplay = z.infer<typeof dynamicAppResponseDisplaySchema>;
export type DynamicAppResponseSchema = z.infer<typeof dynamicAppResponseSchema>;
export type AppSchema = z.infer<typeof dynamicAppSchema>;
export type DynamicAppCatalogItem = z.infer<typeof appInfoSchema>;
export type DynamicAppsResponse = z.infer<typeof dynamicAppsResponseSchema>;
export type DynamicAppFormData = Record<string, unknown>;
export type DynamicAppFormErrors = Record<string, string>;

function isMissingDynamicAppFieldValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	);
}

function isValidDateFieldValue(value: unknown): boolean {
	if (value instanceof Date) {
		return !Number.isNaN(value.getTime());
	}

	return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function getDynamicAppFieldError(field: DynamicAppFormField, value: unknown): string | undefined {
	if (field.required && isMissingDynamicAppFieldValue(value)) {
		return `${field.label} is required`;
	}

	if (isMissingDynamicAppFieldValue(value)) {
		return undefined;
	}

	const { validation } = field;

	switch (field.type) {
		case "text":
		case "textarea":
			if (typeof value !== "string") {
				return `${field.label} must be a string`;
			}

			if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
				return `${field.label} has an invalid format`;
			}

			if (validation?.minLength !== undefined && value.length < validation.minLength) {
				return `${field.label} must be at least ${validation.minLength} characters`;
			}

			if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
				return `${field.label} must be at most ${validation.maxLength} characters`;
			}

			return undefined;

		case "number":
			if (typeof value !== "number" || Number.isNaN(value)) {
				return `${field.label} must be a number`;
			}

			if (validation?.min !== undefined && value < validation.min) {
				return `${field.label} must be at least ${validation.min}`;
			}

			if (validation?.max !== undefined && value > validation.max) {
				return `${field.label} must be at most ${validation.max}`;
			}

			return undefined;

		case "select":
			if (typeof value !== "string") {
				return `${field.label} must be a string`;
			}

			if (validation?.options && !validation.options.some((option) => option.value === value)) {
				return `${field.label} has an invalid option`;
			}

			return undefined;

		case "multiselect":
			if (!Array.isArray(value)) {
				return `${field.label} must be an array`;
			}

			if (validation?.options) {
				const validValues = validation.options.map((option) => option.value);
				const hasInvalidValue = value.some(
					(item) => typeof item !== "string" || !validValues.includes(item),
				);

				if (hasInvalidValue) {
					return `${field.label} has an invalid option`;
				}
			}

			return undefined;

		case "checkbox":
			return typeof value === "boolean" ? undefined : `${field.label} must be a boolean`;

		case "date":
			return isValidDateFieldValue(value) ? undefined : `${field.label} must be a valid date`;

		case "file":
			return value === undefined ? `${field.label} must have a file` : undefined;
	}
}

export function getDynamicAppFormStepErrors(
	step: DynamicAppFormStep,
	formData: DynamicAppFormData,
): DynamicAppFormErrors {
	const errors: DynamicAppFormErrors = {};

	for (const field of step.fields) {
		const error = getDynamicAppFieldError(field, formData[field.id]);
		if (error) {
			errors[field.id] = error;
		}
	}

	return errors;
}

export function getDynamicAppFormErrors(
	app: Pick<AppSchema, "formSchema">,
	formData: DynamicAppFormData,
): DynamicAppFormErrors {
	const fieldIds = new Set(
		app.formSchema.steps.flatMap((step) => step.fields.map((field) => field.id)),
	);
	const errors: DynamicAppFormErrors = {};

	for (const step of app.formSchema.steps) {
		Object.assign(errors, getDynamicAppFormStepErrors(step, formData));
	}

	for (const key of Object.keys(formData)) {
		if (!fieldIds.has(key)) {
			errors[key] = `Unknown field ${key} in form data`;
		}
	}

	return errors;
}

export const weatherResponseSchema = z.object({
	response: z.object({
		status: z.enum(["success", "error"]),
		name: z.string(),
		content: z.string(),
		data: z
			.object({
				cod: z.number(),
				main: z.object({
					temp: z.number(),
					feels_like: z.number(),
					temp_min: z.number(),
					temp_max: z.number(),
					pressure: z.number(),
					humidity: z.number(),
				}),
				weather: z.array(
					z.object({
						main: z.string(),
						description: z.string(),
					}),
				),
				wind: z.object({
					speed: z.number(),
					deg: z.number(),
				}),
				clouds: z.object({ all: z.number() }),
				sys: z.object({ country: z.string() }),
				name: z.string(),
			})
			.optional(),
	}),
});

export const articleSessionSummarySchema = z.object({
	item_id: z.string(),
	id: z.string().optional(),
	title: z.string(),
	created_at: z.string(),
	source_article_count: z.number().optional(),
	status: z.enum(["processing", "complete"]),
});

export const listArticlesResponseSchema = z.object({
	articles: z.array(articleSessionSummarySchema),
});

export const sourceArticlesResponseSchema = z.object({
	status: z.string(),
	articles: z.array(
		z.object({
			id: z.string(),
			user_id: z.number(),
			app_id: z.string(),
			item_id: z.string().optional(),
			item_type: z.string().optional(),
			data: z.string(),
			share_id: z.string().optional(),
			created_at: z.string(),
			updated_at: z.string(),
		}),
	),
});

export const articleDetailResponseSchema = z.object({
	article: z.object({
		id: z.string(),
		user_id: z.number(),
		app_id: z.string(),
		item_id: z.string().optional(),
		item_type: z.string().optional(),
		data: z.string(),
		share_id: z.string().optional(),
		created_at: z.string(),
		updated_at: z.string(),
	}),
});

export const listPodcastsResponseSchema = z.object({
	podcasts: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			createdAt: z.string(),
			imageUrl: z.string().optional(),
			duration: z.number().optional(),
			status: z.enum(["processing", "transcribing", "summarizing", "complete"]),
		}),
	),
});

export const podcastDetailResponseSchema = z.object({
	podcast: z.object({
		id: z.string(),
		title: z.string(),
		description: z.string().optional(),
		createdAt: z.string(),
		imageUrl: z.string().optional(),
		audioUrl: z.string(),
		duration: z.number().optional(),
		transcript: z.string().optional(),
		summary: z.string().optional(),
		status: z.enum(["processing", "transcribing", "summarizing", "complete"]),
	}),
});

export const noteSchema = z.object({
	id: z.string(),
	title: z.string(),
	content: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const noteCreateSchema = z.object({
	title: z.string(),
	content: z.string(),
	metadata: z.record(z.string(), z.any()).optional(),
});

export const noteUpdateSchema = noteCreateSchema.extend({
	options: z
		.object({
			refreshMetadata: z
				.boolean()
				.optional()
				.describe("When true, forces the API to regenerate AI metadata for the note"),
		})
		.optional(),
});

export const listNotesResponseSchema = z.object({
	notes: z.array(noteSchema),
});

export const noteDetailResponseSchema = z.object({
	note: noteSchema,
});

export const noteFormatSchema = z.object({
	prompt: z.string().optional().meta({
		description: "Optional additional instructions to refine the note formatting",
	}),
});

export const noteFormatResponseSchema = z.object({
	content: z.string().meta({
		description: "The reformatted note contents",
	}),
});

export const shareItemSchema = z
	.object({
		app_id: z.string().meta({
			description: "The ID of the app",
		}),
	})
	.meta({
		description: "Schema for sharing an app item",
	});

export const sharedItemResponseSchema = z
	.object({
		status: z.enum(["success", "error"]),
		share_id: z.string().optional(),
		message: z.string().optional(),
		item: z
			.object({
				id: z.string(),
				app_id: z.string(),
				item_id: z.string().optional(),
				item_type: z.string().optional(),
				data: z.any(),
				share_id: z.string().optional(),
				created_at: z.string(),
				updated_at: z.string(),
			})
			.optional(),
	})
	.meta({
		description: "Response for shared item operations",
	});

export const generateNotesFromMediaSchema = z.object({
	url: z.string().url().describe("The audio/video URL to transcribe and analyze."),
	outputs: z
		.array(
			z.enum([
				"concise_summary",
				"detailed_outline",
				"key_takeaways",
				"action_items",
				"meeting_minutes",
				"qa_extraction",
				"scene_analysis",
				"visual_insights",
				"smart_timestamps",
			]),
		)
		.min(1)
		.describe("Which outputs to generate. Can select multiple."),
	noteType: z
		.enum([
			"general",
			"meeting",
			"training",
			"lecture",
			"interview",
			"podcast",
			"webinar",
			"tutorial",
			"video_content",
			"educational_video",
			"documentary",
			"other",
		])
		.default("general")
		.describe("Adjusts prompt style for the content type."),
	extraPrompt: z.string().optional().describe("Additional instructions."),
	timestamps: z.boolean().optional().describe("Whether to enable timestamped transcription."),
	useVideoAnalysis: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"Use Twelve Labs Pegasus for advanced video content analysis including visual elements.",
		),
	enableVideoSearch: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"Generate video embeddings with Twelve Labs Marengo for semantic search capabilities.",
		),
});

export const generateNotesFromMediaResponseSchema = z.object({
	content: z.string().describe("Generated notes content in Markdown."),
});

export const listDynamicAppResponsesQuerySchema = z.object({
	appId: z.string().optional(),
});

export const strudelGenerateSchema = z.object({
	prompt: z
		.string()
		.min(1)
		.describe("Natural language description of the music pattern to generate"),
	style: z
		.enum(["techno", "ambient", "house", "jazz", "drums", "experimental"])
		.optional()
		.describe("Musical style preset"),
	tempo: z.number().min(60).max(200).optional().describe("Beats per minute (BPM)"),
	complexity: z
		.enum(["simple", "medium", "complex"])
		.optional()
		.default("medium")
		.describe("Pattern complexity level"),
	model: z
		.string()
		.optional()
		.describe("Model ID to use for generation (if not specified, uses auxiliary model)"),
	options: z.record(z.string(), z.any()).optional().describe("Additional generation options"),
});

export const strudelSavePatternSchema = z.object({
	code: z.string().min(1).describe("The Strudel pattern code to save"),
	name: z.string().min(1).max(100).describe("Name for this pattern"),
	description: z.string().max(500).optional().describe("Optional description"),
	tags: z.array(z.string()).optional().describe("Tags for categorization"),
});

export const strudelUpdatePatternSchema = z.object({
	code: z.string().min(1).optional(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	tags: z.array(z.string()).optional(),
});

export const strudelPatternSchema = z.object({
	id: z.string(),
	name: z.string(),
	code: z.string(),
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const strudelGenerateResponseSchema = z.object({
	code: z.string().describe("Generated Strudel pattern code"),
	explanation: z.string().optional().describe("Explanation of the generated pattern"),
	generationId: z.string().describe("Unique ID for feedback tracking"),
});

export const strudelListPatternsResponseSchema = z.object({
	patterns: z.array(strudelPatternSchema),
});

export const strudelPatternDetailResponseSchema = z.object({
	pattern: strudelPatternSchema,
});

export const recipeCategorySchema = z.enum([
	"Calendar",
	"Community",
	"Developer",
	"Email",
	"Finance",
	"Health",
	"Home",
	"Productivity",
	"Scheduling",
	"Shopping",
	"Students",
	"To-dos",
	"Travel",
]);

export const recipeKindSchema = z.enum(["automate", "integrate"]);

export const recipeTriggerSchema = z.object({
	type: z.enum(["message", "schedule", "event"]),
	label: z.string(),
	description: z.string(),
});

export const recipeConnectionStatusSchema = z.enum([
	"connected",
	"missing",
	"not_required",
	"unconfigured",
	"unknown",
]);

export const recipeConnectorProviderSchema = z.enum([
	"asana",
	"fitbit",
	"gmail",
	"outlook",
	"calendar",
	"github",
	"linear",
	"netlify",
	"notion",
	"oura",
	"posthog",
	"sentry",
	"todoist",
	"vercel",
	"withings",
]);

export const recipeIntegrationSchema = z.object({
	id: z.string(),
	providerId: z.string(),
	name: z.string(),
	description: z.string(),
	requiresConnection: z.boolean().default(true),
	operationIds: z.array(z.string()).optional(),
	connectionStatus: recipeConnectionStatusSchema.optional(),
	setupUrl: z.string().optional(),
});

export const recipeConfigurationValueSchema = z.union([
	z.string().max(4000),
	z.number(),
	z.boolean(),
	z.array(z.string().max(1000)).max(50),
	z.null(),
]);

export const recipeConfigurationSchema = z
	.record(z.string().min(1).max(80), recipeConfigurationValueSchema)
	.default({});

export const recipeConfigurationFieldSchema = z.object({
	key: z.string().min(1).max(80),
	label: z.string(),
	description: z.string().optional(),
	type: z.enum(["text", "textarea", "number", "boolean", "string_list"]),
	required: z.boolean().optional(),
	placeholder: z.string().optional(),
	defaultValue: recipeConfigurationValueSchema.optional(),
});

export const assistantRecipeSchema = z.object({
	id: z.string(),
	title: z.string(),
	summary: z.string(),
	description: z.string(),
	kind: recipeKindSchema,
	category: recipeCategorySchema,
	featured: z.boolean(),
	estimatedSetupMinutes: z.number().int().positive(),
	integrations: z.array(recipeIntegrationSchema),
	triggers: z.array(recipeTriggerSchema),
	actions: z.array(z.string()),
	setupPrompt: z.string(),
	enabledTools: z.array(z.string()).default([]),
	configurationFields: z.array(recipeConfigurationFieldSchema).default([]),
});

export const assistantRecipesResponseSchema = z.object({
	recipes: z.array(assistantRecipeSchema),
	categories: z.array(recipeCategorySchema),
	filters: z.array(recipeKindSchema),
});

export const assistantRecipeInstallRequestSchema = z.object({
	channel: z.enum(["web", "ios", "sms"]).default("web"),
	triggers: z.lazy(() => z.array(recipeInstallationTriggerSchema)).optional(),
	configuration: z.lazy(() => recipeConfigurationSchema).optional(),
});

export const assistantRecipeConnectionSchema = z.object({
	integrationId: z.string(),
	providerId: z.string(),
	name: z.string(),
	status: recipeConnectionStatusSchema,
	requiresConnection: z.boolean(),
	setupUrl: z.string().optional(),
});

export const assistantRecipeInstallResponseSchema = z.object({
	recipe: assistantRecipeSchema,
	conversationStarter: z.string(),
	messageUrl: z.string(),
	checklist: z.array(z.string()),
	connections: z.array(assistantRecipeConnectionSchema),
	readyToRun: z.boolean(),
	enabledTools: z.array(z.string()).default([]),
	installation: z.lazy(() => recipeInstallationSchema).optional(),
});

export type RecipeCategory = z.infer<typeof recipeCategorySchema>;
export type RecipeKind = z.infer<typeof recipeKindSchema>;
export type RecipeConnectionStatus = z.infer<typeof recipeConnectionStatusSchema>;
export type RecipeConfigurationField = z.infer<typeof recipeConfigurationFieldSchema>;
export type AssistantRecipe = z.infer<typeof assistantRecipeSchema>;
export type AssistantRecipesResponse = z.infer<typeof assistantRecipesResponseSchema>;
export type AssistantRecipeInstallRequest = z.infer<typeof assistantRecipeInstallRequestSchema>;
export type AssistantRecipeConnection = z.infer<typeof assistantRecipeConnectionSchema>;
export type AssistantRecipeInstallResponse = z.infer<typeof assistantRecipeInstallResponseSchema>;

export type RecipeConfiguration = z.infer<typeof recipeConfigurationSchema>;

export const recipeConnectorStatusSchema = z.enum(["connected", "disconnected", "unconfigured"]);

export const recipeConnectorManifestSchema = z.object({
	id: recipeConnectorProviderSchema,
	name: z.string(),
	description: z.string(),
	authType: z.enum(["oauth2", "github_app", "api_key"]),
	status: recipeConnectorStatusSchema,
	setupUrl: z.string().optional(),
	authorizationUrl: z.string().optional(),
	credentialLabel: z.string().optional(),
	connectedAt: z.string().optional(),
	updatedAt: z.string().optional(),
	scopes: z.array(z.string()),
	operations: z.array(z.string()).default([]),
});

export const recipeConnectorsResponseSchema = z.object({
	connectors: z.array(recipeConnectorManifestSchema),
});

export const recipeConnectorStartResponseSchema = z.object({
	provider: recipeConnectorProviderSchema,
	authorizationUrl: z.string(),
});

export const recipeConnectorStartRequestSchema = z.object({
	returnTo: z.string().optional(),
});

export const recipeConnectorApiKeyRequestSchema = z.object({
	apiKey: z.string().min(1).max(4000),
});

export const recipeInstallationTriggerSchema = z
	.object({
		type: z.enum(["manual", "schedule", "natural_language"]),
		enabled: z.boolean().default(true),
		cronExpression: z
			.string()
			.regex(/^[\d*/, -]+ [\d*/, -]+ [\d*/, -]+ [\d*/, -]+ [\d*/, -]+$/)
			.optional(),
		prompt: z.string().optional(),
		notificationChannel: z.enum(["sms"]).optional(),
		notificationTarget: z.string().optional(),
	})
	.superRefine((trigger, ctx) => {
		if (trigger.type === "schedule" && !trigger.cronExpression?.trim()) {
			ctx.addIssue({
				code: "custom",
				path: ["cronExpression"],
				message: "Schedule triggers require a cron expression",
			});
		}
		if (trigger.notificationChannel === "sms" && !trigger.notificationTarget?.trim()) {
			ctx.addIssue({
				code: "custom",
				path: ["notificationTarget"],
				message: "SMS recipe notifications require a target phone number",
			});
		}
	});

export const recipeInstallationSchema = z.object({
	id: z.string(),
	recipeId: z.string(),
	userId: z.number(),
	status: z.enum(["active", "paused"]),
	triggers: z.array(recipeInstallationTriggerSchema),
	configuration: recipeConfigurationSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const recipeInstallationsResponseSchema = z.object({
	installations: z.array(recipeInstallationSchema),
});

export const recipeInstallRequestSchema = assistantRecipeInstallRequestSchema;

export const recipeInstallationUpdateRequestSchema = z.object({
	status: z.enum(["active", "paused"]).optional(),
	triggers: z.array(recipeInstallationTriggerSchema).optional(),
	configuration: recipeConfigurationSchema.optional(),
});

export const recipeInvocationRequestSchema = z.object({
	input: z.string().optional(),
	channel: z.enum(["web", "ios", "sms", "scheduled", "tool"]).default("web"),
});

export const recipeInvocationResponseSchema = z.object({
	recipeId: z.string(),
	installationId: z.string().optional(),
	channel: z.enum(["web", "ios", "sms", "scheduled", "tool"]).default("web"),
	status: z.enum(["ready", "queued", "blocked", "not_installed"]),
	conversationStarter: z.string(),
	messageUrl: z.string(),
	missingConnections: z.array(assistantRecipeConnectionSchema),
	enabledTools: z.array(z.string()).default([]),
	allowedConnectorProviders: z.array(recipeConnectorProviderSchema).default([]),
	allowedConnectorOperations: z.record(z.string(), z.array(z.string())).optional(),
	configuration: recipeConfigurationSchema,
	taskId: z.string().optional(),
});

export type RecipeConnectorProvider = z.infer<typeof recipeConnectorProviderSchema>;
export type RecipeConnectorStatus = z.infer<typeof recipeConnectorStatusSchema>;
export type RecipeConnectorManifest = z.infer<typeof recipeConnectorManifestSchema>;
export type RecipeConnectorsResponse = z.infer<typeof recipeConnectorsResponseSchema>;
export type RecipeConnectorStartResponse = z.infer<typeof recipeConnectorStartResponseSchema>;
export type RecipeConnectorStartRequest = z.infer<typeof recipeConnectorStartRequestSchema>;
export type RecipeConnectorApiKeyRequest = z.infer<typeof recipeConnectorApiKeyRequestSchema>;
export type RecipeInstallationTrigger = z.infer<typeof recipeInstallationTriggerSchema>;
export type RecipeInstallation = z.infer<typeof recipeInstallationSchema>;
export type RecipeInstallationsResponse = z.infer<typeof recipeInstallationsResponseSchema>;
export type RecipeInstallRequest = z.infer<typeof recipeInstallRequestSchema>;
export type RecipeInstallationUpdateRequest = z.infer<typeof recipeInstallationUpdateRequestSchema>;
export type RecipeInvocationRequest = z.infer<typeof recipeInvocationRequestSchema>;
export type RecipeInvocationResponse = z.infer<typeof recipeInvocationResponseSchema>;
