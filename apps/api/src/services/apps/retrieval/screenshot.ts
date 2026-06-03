import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";

export interface CaptureScreenshotParams {
	url?: string;
	html?: string;
	screenshotOptions?: {
		omitBackground?: boolean;
		fullPage?: boolean;
	};
	viewport?: {
		width?: number;
		height?: number;
	};
	gotoOptions?: {
		waitUntil?: "load" | "domcontentloaded" | "networkidle0";
		timeout?: number;
	};
	addScriptTag?: Array<{
		url?: string;
		content?: string;
	}>;
	addStyleTag?: Array<{
		url?: string;
		content?: string;
	}>;
}

export interface CaptureScreenshotResult {
	status: "success" | "error";
	error?: string;
	data?: {
		url?: string;
		assetId: string;
		screenshotUrl: string;
		key: string;
	};
}

export const captureScreenshot = async (
	params: CaptureScreenshotParams,
	req: IRequest,
): Promise<CaptureScreenshotResult> => {
	try {
		if (!req.env.ACCOUNT_ID) {
			throw new AssistantError("Cloudflare Account ID not configured", ErrorType.PARAMS_ERROR);
		}

		if (!req.env.BROWSER_RENDERING_API_KEY) {
			throw new AssistantError("Browser Rendering API Key not configured", ErrorType.PARAMS_ERROR);
		}

		if (!params.url && !params.html) {
			throw new AssistantError("Either URL or HTML must be provided", ErrorType.PARAMS_ERROR);
		}

		const screenshotId = generateId();
		const urlAsKey = params.url?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
		const dateAsKey = new Date().toISOString().replace(/[-:Z]/g, "");
		const imageKey = `screenshots/${urlAsKey}/${dateAsKey}/${screenshotId}.png`;

		const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${req.env.ACCOUNT_ID}/browser-rendering/screenshot`;

		const requestBody: Record<string, any> = {};

		if (params.url) {
			requestBody.url = params.url;
		}

		if (params.html) {
			requestBody.html = params.html;
		}

		if (params.screenshotOptions) {
			requestBody.screenshotOptions = params.screenshotOptions;
		}

		if (params.viewport) {
			requestBody.viewport = params.viewport;
		}

		if (params.gotoOptions) {
			requestBody.gotoOptions = params.gotoOptions;
		}

		if (params.addScriptTag && params.addScriptTag.length > 0) {
			requestBody.addScriptTag = params.addScriptTag;
		}

		if (params.addStyleTag && params.addStyleTag.length > 0) {
			requestBody.addStyleTag = params.addStyleTag;
		}

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${req.env.BROWSER_RENDERING_API_KEY}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new AssistantError(
				`Error capturing screenshot: ${errorText}`,
				ErrorType.PROVIDER_ERROR,
			);
		}

		const imageBuffer = await response.arrayBuffer();

		if (!req.user?.id) {
			throw new AssistantError("User data required", ErrorType.AUTHENTICATION_ERROR);
		}

		const serviceContext = resolveServiceContext({
			context: req.context,
			env: req.env,
			user: req.user,
		});
		const storedScreenshot = await StorageService.forPrivateAssets(
			serviceContext,
		).storePrivateAsset({
			key: imageKey,
			data: imageBuffer,
			ownerUserId: req.user.id,
			purpose: "app_artifact",
			mimeType: "image/png",
			filename: "screenshot.png",
			byteSize: imageBuffer.byteLength,
		});

		return {
			status: "success",
			data: {
				url: params.url,
				assetId: storedScreenshot.assetId,
				screenshotUrl: storedScreenshot.url,
				key: imageKey,
			},
		};
	} catch (error) {
		if (error instanceof AssistantError) {
			return {
				status: "error",
				error: error.message,
			};
		}

		return {
			status: "error",
			error: `Error capturing screenshot: ${error}`,
		};
	}
};
