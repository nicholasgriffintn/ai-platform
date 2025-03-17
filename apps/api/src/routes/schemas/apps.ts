import { z } from "zod";
import "zod-openapi/extend";

export const insertEmbeddingSchema = z.object({
	type: z.string(),
	content: z.string(),
	id: z.string().optional(),
	metadata: z.record(z.any()).optional(),
	title: z.string().optional(),
	rag_options: z.object({
		namespace: z.string().optional(),
	}),
});

export const queryEmbeddingsSchema = z.object({
	query: z.string(),
	namespace: z.string().optional(),
});

export const deleteEmbeddingSchema = z.object({
	ids: z.array(z.string()),
});

export const weatherQuerySchema = z.object({
	longitude: z.string().transform((val) => Number.parseFloat(val)),
	latitude: z.string().transform((val) => Number.parseFloat(val)),
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
	drawing: z.any(),
});

export const guessDrawingSchema = z.object({
	drawing: z.any(),
});

export const podcastUploadSchema = z.object({
	audioUrl: z.string().url().optional(),
});

export const podcastTranscribeSchema = z.object({
	podcastId: z.string(),
	numberOfSpeakers: z.number(),
	prompt: z.string(),
});

export const podcastSummarizeSchema = z.object({
	podcastId: z.string(),
	speakers: z.record(z.string()),
});

export const podcastGenerateImageSchema = z.object({
	podcastId: z.string(),
});

export const articleAnalyzeSchema = z.object({
	article: z.string(),
});

export const articleSummariseSchema = z.object({
	article: z.string(),
});

export const generateArticlesReportSchema = z.object({
	articles: z.string(),
});

export const webSearchSchema = z.object({
	query: z.string(),
	search_depth: z.enum(["basic", "advanced"]).optional(),
	include_answer: z.boolean().optional(),
	include_raw_content: z.boolean().optional(),
	include_images: z.boolean().optional(),
});

export const contentExtractSchema = z.object({
	urls: z.array(z.string().url()),
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
	pages: z.array(z.number()).optional().openapi({
		description:
			"Specific pages user wants to process in various formats: single number, range, or list of both. Starts from 0",
	}),
	include_image_base64: z.boolean().optional().openapi({
		description:
			"Whether to include the images in a base64 format in the response",
	}),
	image_limit: z.number().optional().openapi({
		description: "Limit the number of images to extract",
	}),
	image_min_size: z.number().optional().openapi({
		description: "Minimum height and width of image to extract",
	}),
	output_format: z.enum(["json", "html", "markdown"]).optional().openapi({
		description: "Output format of the response",
	}),
});
