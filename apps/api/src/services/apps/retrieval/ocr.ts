import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { StorageService } from "~/lib/storage";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { convertMarkdownToHtml } from "~/utils/markdown";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "services/apps/retrieval/ocr" });

export interface OcrParams {
	model?: string;
	document: {
		type: "document_url";
		document_url: string;
		document_name: string;
	};
	id?: string;
	pages?: number[];
	include_image_base64?: boolean;
	image_limit?: number;
	image_min_size?: number;
	output_format?: "json" | "html" | "markdown";
}

export interface OcrResult {
	status: "success" | "error";
	error?: string;
	data?: any;
}

/**
 * Performs OCR on an image using Mistral API
 * @param params - OCR parameters including the image
 * @param req - Request object containing environment variables
 * @returns OCR result with extracted text
 */
export const performOcr = async (
	params: OcrParams,
	req: IRequest,
): Promise<OcrResult> => {
	try {
		if (!req.env.MISTRAL_API_KEY) {
			throw new AssistantError(
				"Mistral API key not configured",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (!params.document) {
			throw new AssistantError("Document is required", ErrorType.PARAMS_ERROR);
		}

		const baseAssetsUrl = req.env.PUBLIC_ASSETS_URL || "";

		const requestId = params.id || generateId();

		const provider = getChatProvider("mistral", {
			env: req.env,
			user: req.user,
		});

		const response = await provider.getResponse({
			env: req.env,
			completion_id: requestId,
			model: params.model || "mistral-ocr-latest",
			body: {
				document: params.document,
				model: params.model || "mistral-ocr-latest",
				id: requestId,
				pages: params.pages,
				include_image_base64: params.include_image_base64 ?? true,
				image_limit: params.image_limit,
				image_min_size: params.image_min_size,
			},
			store: false,
			user: req.user,
		});

		const storageService = new StorageService(req.env.ASSETS_BUCKET);

		if (params.output_format === "json") {
			const jsonUrl = await storageService.uploadObject(
				`ocr/${requestId}/output.json`,
				JSON.stringify(response),
				{
					contentType: "application/json",
					contentLength: JSON.stringify(response).length,
				},
			);

			return {
				status: "success",
				data: {
					model: response?.data?.model ?? params.model,
					url: `${baseAssetsUrl}/${jsonUrl}`,
					key: jsonUrl,
				},
			};
		}

		const imagesFromPages = response.pages.flatMap(
			(page: any) => page.images || [],
		);
		const imageMap: Record<string, string> = {};
		if (imagesFromPages && Array.isArray(imagesFromPages)) {
			for (const image of imagesFromPages) {
				if (image.id && image.image_base64) {
					imageMap[image.id] = image.image_base64;
				}
			}
		}

		let allMarkdown = "";
		for (let i = 0; i < response.pages.length; i++) {
			const page = response.pages[i];
			let pageContent = page.markdown || page.text || "";

			for (const [imageId, imageBase64] of Object.entries(imageMap)) {
				// Find all markdown image references with this image ID
				const imagePattern = new RegExp(`!\\[(.*?)\\]\\(${imageId}\\)`, "g");
				pageContent = pageContent.replace(
					imagePattern,
					`![${imageId}](${imageBase64})`,
				);
			}

			allMarkdown += `${pageContent}\n\n`;
		}

		if (params.output_format === "html") {
			const htmlContent = convertMarkdownToHtml(allMarkdown);

			response.html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OCR Result</title>
    <style>
        body { 
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0 auto;
            max-width: 800px;
            padding: 20px;
        }
        img { max-width: 100%; height: auto; }
        h1, h2, h3 { margin-top: 1.5em; }
        p { margin: 1em 0; }
        blockquote { 
            border-left: 4px solid #ccc;
            margin-left: 0;
            padding-left: 16px;
        }
        code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f5f5f5; padding: 16px; overflow: auto; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

			const htmlUrl = await storageService.uploadObject(
				`ocr/${requestId}/output.html`,
				response.html,
				{
					contentType: "text/html",
					contentLength: response.html.length,
				},
			);

			return {
				status: "success",
				data: {
					model: response?.data?.model ?? params.model,
					url: `${baseAssetsUrl}/${htmlUrl}`,
					key: htmlUrl,
				},
			};
		}

		const markdownUrl = await storageService.uploadObject(
			`ocr/${requestId}/output.md`,
			allMarkdown,
			{
				contentType: "text/markdown",
				contentLength: allMarkdown.length,
			},
		);

		return {
			status: "success",
			data: {
				model: response?.data?.model ?? params.model,
				url: `${baseAssetsUrl}/${markdownUrl}`,
				key: markdownUrl,
			},
		};
	} catch (error) {
		logger.error("OCR error:", { error });

		if (error instanceof AssistantError) {
			return {
				status: "error",
				error: error.message,
			};
		}

		return {
			status: "error",
			error: "Failed to perform OCR on the image",
		};
	}
};
