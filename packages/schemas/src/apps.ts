import z from "zod/v4";

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
		description:
			"Whether to include the images in a base64 format in the response",
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
	level: z
		.enum(["beginner", "intermediate", "advanced"])
		.prefault("advanced")
		.optional(),
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
		.enum([
			"violet",
			"indigo",
			"pink",
			"rose",
			"cyan",
			"emerald",
			"amber",
			"sky",
			"slate",
		])
		.optional(),
	tags: z.array(z.string()).optional(),
	featured: z.boolean().optional(),
	costPerCall: z.number().optional(),
	isDefault: z.boolean().optional(),
	type: z.enum(["normal", "premium"]).optional(),
	href: z.string().optional(),
	kind: z.enum(["dynamic", "frontend"]).optional(),
});

export const appInfoArraySchema = z.array(appInfoSchema);

export const dynamicAppsResponseSchema = z.object({
	apps: appInfoArraySchema,
});

export const dynamicAppIdParamSchema = z.object({ id: z.string() });

export const dynamicAppExecuteRequestSchema = z.record(z.string(), z.any());

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
				.describe(
					"When true, forces the API to regenerate AI metadata for the note",
				),
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
		description:
			"Optional additional instructions to refine the note formatting",
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
	url: z
		.string()
		.url()
		.describe("The audio/video URL to transcribe and analyze."),
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
	timestamps: z
		.boolean()
		.optional()
		.describe("Whether to enable timestamped transcription."),
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
	tempo: z
		.number()
		.min(60)
		.max(200)
		.optional()
		.describe("Beats per minute (BPM)"),
	complexity: z
		.enum(["simple", "medium", "complex"])
		.optional()
		.default("medium")
		.describe("Pattern complexity level"),
	model: z
		.string()
		.optional()
		.describe(
			"Model ID to use for generation (if not specified, uses auxiliary model)",
		),
	options: z
		.record(z.string(), z.any())
		.optional()
		.describe("Additional generation options"),
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
	explanation: z
		.string()
		.optional()
		.describe("Explanation of the generated pattern"),
});

export const strudelListPatternsResponseSchema = z.object({
	patterns: z.array(strudelPatternSchema),
});

export const strudelPatternDetailResponseSchema = z.object({
	pattern: strudelPatternSchema,
});
