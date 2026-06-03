import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { convertMarkdownToHtml } from "~/utils/markdown";
import { escapeRegExp } from "~/utils/strings";
import type { OcrOutputFormat } from "./types";

export interface OcrImage {
	id?: string;
	image_base64?: string;
}

export interface OcrPage {
	markdown?: string;
	text?: string;
	images?: OcrImage[];
}

export interface OcrApiResponse {
	model?: string;
	data?: {
		model?: string;
	};
	pages?: OcrPage[];
	eventId?: string;
	log_id?: string;
	cacheStatus?: string;
}

export interface PersistedOcrOutput {
	key: string;
	url: string;
	outputFormat: OcrOutputFormat;
}

interface PersistOcrOutputOptions {
	requestId: string;
	response: OcrApiResponse;
	outputFormat: OcrOutputFormat;
	context: ServiceContext;
	ownerUserId: number;
}

function buildHtmlDocument(markdown: string): string {
	const htmlContent = convertMarkdownToHtml(markdown);

	return `<!DOCTYPE html>
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
}

function collectImages(pages: OcrPage[]): Map<string, string> {
	const images = new Map<string, string>();

	for (const page of pages) {
		for (const image of page.images ?? []) {
			if (typeof image.id === "string" && typeof image.image_base64 === "string") {
				images.set(image.id, image.image_base64);
			}
		}
	}

	return images;
}

export function buildOcrMarkdown(response: OcrApiResponse): string {
	const pages = Array.isArray(response.pages) ? response.pages : [];
	const images = collectImages(pages);
	const pageContent = pages.map((page) => {
		let content = page.markdown || page.text || "";

		for (const [imageId, imageBase64] of images) {
			const imagePattern = new RegExp(`!\\[(.*?)\\]\\(${escapeRegExp(imageId)}\\)`, "g");
			content = content.replace(imagePattern, `![${imageId}](${imageBase64})`);
		}

		return content;
	});

	return pageContent.length ? `${pageContent.join("\n\n")}\n\n` : "";
}

export function getOcrResponseModel(response: OcrApiResponse): string | undefined {
	return response.model ?? response.data?.model;
}

export async function persistOcrOutput({
	requestId,
	response,
	outputFormat,
	context,
	ownerUserId,
}: PersistOcrOutputOptions): Promise<PersistedOcrOutput> {
	const storage = StorageService.forPrivateAssets(context);

	if (outputFormat === "json") {
		const content = JSON.stringify(response);
		const storedOutput = await storage.storePrivateAsset({
			key: `ocr/${requestId}/output.json`,
			data: content,
			ownerUserId,
			purpose: "ocr_output",
			mimeType: "application/json",
			filename: "output.json",
			byteSize: content.length,
		});

		return {
			key: storedOutput.key,
			url: storedOutput.url,
			outputFormat,
		};
	}

	const markdown = buildOcrMarkdown(response);

	if (outputFormat === "html") {
		const html = buildHtmlDocument(markdown);
		const storedOutput = await storage.storePrivateAsset({
			key: `ocr/${requestId}/output.html`,
			data: html,
			ownerUserId,
			purpose: "ocr_output",
			mimeType: "text/html",
			filename: "output.html",
			byteSize: html.length,
		});

		return {
			key: storedOutput.key,
			url: storedOutput.url,
			outputFormat,
		};
	}

	const storedOutput = await storage.storePrivateAsset({
		key: `ocr/${requestId}/output.md`,
		data: markdown,
		ownerUserId,
		purpose: "ocr_output",
		mimeType: "text/markdown",
		filename: "output.md",
		byteSize: markdown.length,
	});

	return {
		key: storedOutput.key,
		url: storedOutput.url,
		outputFormat,
	};
}
