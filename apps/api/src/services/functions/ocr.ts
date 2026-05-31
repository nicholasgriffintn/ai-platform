import { getOcrProvider, resolveOcrProviderName } from "~/lib/providers/capabilities/ocr/index";
import {
	DEFAULT_OCR_MODEL,
	DEFAULT_OCR_PROVIDER,
} from "~/lib/providers/capabilities/ocr/constants";
import type { OcrExtractionRequest } from "~/lib/providers/capabilities/ocr/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

type OcrToolRequest = Omit<OcrExtractionRequest, "env" | "user" | "storage">;

export const extract_text_from_document: ApiToolDefinition = {
	name: "extract_text_from_document",
	description:
		"Extracts text content from documents and images using OCR (Optical Character Recognition). Supports PDF files, scanned documents, and images containing text. Returns the extracted content in various formats (JSON, HTML, or Markdown).",
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			document_url: {
				type: "string",
				description: "The URL of the document or image to extract text from",
			},
			document_name: {
				type: "string",
				description: "The name of the document being processed",
			},
			model: {
				type: "string",
				description: "The OCR model to use",
				enum: [DEFAULT_OCR_MODEL],
				default: DEFAULT_OCR_MODEL,
			},
			provider: {
				type: "string",
				description: "OCR provider",
				enum: [DEFAULT_OCR_PROVIDER],
				default: DEFAULT_OCR_PROVIDER,
			},
			pages: {
				type: "array",
				description:
					"Specific page numbers to process (optional). If not provided, all pages will be processed",
				items: {
					type: "integer",
				},
			},
			include_image_base64: {
				type: "boolean",
				description: "Whether to include base64-encoded images in the output. Defaults to true",
				default: true,
			},
			image_limit: {
				type: "integer",
				description: "Maximum number of images to extract from the document",
			},
			image_min_size: {
				type: "integer",
				description: "Minimum size (in pixels) for images to be extracted",
			},
			output_format: {
				type: "string",
				description:
					"Output format for the extracted content. Options: 'json', 'html', 'markdown'. Defaults to 'markdown'",
				enum: ["json", "html", "markdown"],
				default: "markdown",
			},
		},
		required: ["document_url", "document_name"],
	}),
	type: "byok",
	costPerCall: 2,
	permissions: ["read"],
	execute: async (args, context) => {
		const req = context.request;
		const completion_id = context.completionId;

		if (!args.document_url || !args.document_name) {
			throw new Error("document_url and document_name are required parameters");
		}
		const ocrParams: OcrToolRequest = {
			provider: args.provider,
			document: {
				type: "document_url",
				document_url: args.document_url,
				document_name: args.document_name,
			},
			id: completion_id,
			model: args.model,
			pages: args.pages,
			include_image_base64: args.include_image_base64,
			image_limit: args.image_limit,
			image_min_size: args.image_min_size,
			output_format: args.output_format,
		};

		const providerName = await resolveOcrProviderName({
			env: req.env,
			model: ocrParams.model,
			provider: ocrParams.provider,
		});
		const provider = getOcrProvider(providerName, {
			env: req.env,
			user: req.user,
		});
		const response = await provider.extractText({
			...ocrParams,
			provider: providerName,
			env: req.env,
			user: req.user,
		});

		return {
			status: "success",
			name: "extract_text_from_document",
			content: `Extracted text from document ${args.document_name}, you can [download it here](${response.url}).`,
			data: {
				model: response.model,
				provider: providerName,
				url: response.url,
				key: response.key,
				outputFormat: response.outputFormat,
			},
			role: "tool",
		};
	},
};
