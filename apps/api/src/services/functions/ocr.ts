import {
	type OcrParams,
	type OcrResult,
	performOcr,
} from "~/services/apps/retrieval/ocr";
import type { IFunction, IRequest } from "~/types";

export const extract_text_from_document: IFunction = {
	name: "extract_text_from_document",
	description:
		"Extracts text content from documents and images using OCR (Optical Character Recognition). Supports PDF files, scanned documents, and images containing text. Returns the extracted content in various formats (JSON, HTML, or Markdown).",
	parameters: {
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
				description:
					"The OCR model to use. Defaults to 'mistral-ocr-latest' if not specified",
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
				description:
					"Whether to include base64-encoded images in the output. Defaults to true",
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
	},
	type: "premium",
	costPerCall: 2,
	function: async (
		completion_id: string,
		args: {
			document_url: string;
			document_name: string;
			model?: string;
			pages?: number[];
			include_image_base64?: boolean;
			image_limit?: number;
			image_min_size?: number;
			output_format?: "json" | "html" | "markdown";
		},
		req: IRequest,
		app_url?: string,
	) => {
		if (!args.document_url || !args.document_name) {
			throw new Error("document_url and document_name are required parameters");
		}
		const ocrParams: OcrParams = {
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

		const response = await performOcr(ocrParams, req);

		return {
			status: "success",
			name: "extract_text_from_document",
			content: `Extracted text from document ${args.document_name}, you can [download it here](${response?.data?.url}).`,
			data: {
				model: response?.data?.model ?? args.model,
				raw: response,
			},
			role: "tool",
		};
	},
};
