import { StorageService } from "~/lib/storage";
import { fetchAIResponse } from "~/lib/providers/lib/fetch";
import { resolveModelConfig } from "~/lib/providers/models";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { hasUserProviderApiKey, resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { getOcrResponseModel, persistOcrOutput, type OcrApiResponse } from "../format";
import { DEFAULT_OCR_MODEL } from "../constants";
import type { OcrExtractionRequest, OcrExtractionResult, OcrProvider } from "../types";

const logger = getLogger({ prefix: "lib/providers/ocr/mistral" });

interface MistralOcrPayload {
	model: string;
	document: {
		type: "document_url";
		document_url: string;
		document_name?: string;
	};
	id: string;
	pages?: number[];
	include_image_base64?: boolean;
	image_limit?: number;
	image_min_size?: number;
}

export class MistralOcrProvider implements OcrProvider {
	name = "mistral";
	models = [DEFAULT_OCR_MODEL];

	async extractText(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
		try {
			this.validateRequest(request);
			await this.enforceAccess(request);

			const modelConfig = await resolveModelConfig(
				request.model ?? DEFAULT_OCR_MODEL,
				request.env,
				this.name,
				request.user?.id,
			);

			if (!modelConfig.strengths?.includes("ocr")) {
				throw new AssistantError(
					`Model ${modelConfig.name ?? modelConfig.matchingModel} is not configured for OCR`,
					ErrorType.CONFIGURATION_ERROR,
				);
			}

			const requestId = request.id || generateId();
			const response = await this.createOcrResponse(
				request,
				this.buildPayload(request, modelConfig.matchingModel, requestId),
				requestId,
				modelConfig.timeout,
			);
			const storage = request.storage ?? new StorageService(request.env.ASSETS_BUCKET);
			const outputFormat = request.output_format ?? "markdown";
			const asset = await persistOcrOutput({
				requestId,
				response,
				outputFormat,
				storage,
				publicAssetsUrl: request.env.PUBLIC_ASSETS_URL,
			});

			return {
				model: getOcrResponseModel(response) ?? modelConfig.matchingModel,
				...asset,
			};
		} catch (error) {
			logger.error("Mistral OCR error:", { error });

			if (error instanceof AssistantError) {
				throw error;
			}

			throw new AssistantError(
				await formatProviderError(error, "Mistral OCR error"),
				ErrorType.EXTERNAL_API_ERROR,
			);
		}
	}

	private validateRequest(request: OcrExtractionRequest): void {
		if (!request.document) {
			throw new AssistantError("Document is required", ErrorType.PARAMS_ERROR);
		}

		if (!request.document.document_url) {
			throw new AssistantError("document_url is required", ErrorType.PARAMS_ERROR);
		}

		this.validateDocumentUrl(request.document.document_url);
		this.validateIntegerList(request.pages, "pages");
		this.validateOptionalInteger(request.image_limit, "image_limit");
		this.validateOptionalInteger(request.image_min_size, "image_min_size");
	}

	private validateDocumentUrl(url: string): void {
		try {
			const parsedUrl = new URL(url);
			if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
				return;
			}
		} catch {
			// The error below keeps the public validation message stable.
		}

		throw new AssistantError("document_url must be an HTTP or HTTPS URL", ErrorType.PARAMS_ERROR);
	}

	private validateIntegerList(values: number[] | undefined, label: string): void {
		if (!values) {
			return;
		}

		if (!values.every((value) => Number.isInteger(value) && value >= 0)) {
			throw new AssistantError(
				`${label} must contain non-negative integers`,
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	private validateOptionalInteger(value: number | undefined, label: string): void {
		if (value === undefined) {
			return;
		}

		if (!Number.isInteger(value) || value < 0) {
			throw new AssistantError(`${label} must be a non-negative integer`, ErrorType.PARAMS_ERROR);
		}
	}

	private async enforceAccess(request: OcrExtractionRequest): Promise<void> {
		if (request.user?.plan_id === "pro") {
			return;
		}

		if (
			await hasUserProviderApiKey({
				env: request.env,
				user: request.user,
				providerName: this.name,
			})
		) {
			return;
		}

		throw new AssistantError(
			"OCR requires a configured mistral provider key",
			ErrorType.AUTHORISATION_ERROR,
			403,
		);
	}

	private buildPayload(
		request: OcrExtractionRequest,
		model: string,
		requestId: string,
	): MistralOcrPayload {
		return {
			model,
			document: {
				type: request.document.type ?? "document_url",
				document_url: request.document.document_url,
				...(request.document.document_name
					? { document_name: request.document.document_name }
					: {}),
			},
			id: requestId,
			include_image_base64: request.include_image_base64 ?? true,
			...(request.pages ? { pages: request.pages } : {}),
			...(request.image_limit !== undefined ? { image_limit: request.image_limit } : {}),
			...(request.image_min_size !== undefined ? { image_min_size: request.image_min_size } : {}),
		};
	}

	private async buildHeaders(
		request: OcrExtractionRequest,
		requestId: string,
	): Promise<Record<string, string>> {
		if (!request.env.AI_GATEWAY_TOKEN) {
			throw new AssistantError("Missing AI_GATEWAY_TOKEN", ErrorType.CONFIGURATION_ERROR);
		}

		const apiKey = await resolveProviderApiKey({
			env: request.env,
			providerName: this.name,
			envKeyName: "MISTRAL_API_KEY",
			userId: request.user?.id,
			logger,
		});

		return {
			"cf-aig-authorization": request.env.AI_GATEWAY_TOKEN,
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"cf-aig-metadata": JSON.stringify({
				...getAiGatewayMetadataHeaders({
					user: request.user,
					completion_id: requestId,
				}),
				provider: this.name,
				feature: "ocr",
			}),
		};
	}

	private async createOcrResponse(
		request: OcrExtractionRequest,
		payload: MistralOcrPayload,
		requestId: string,
		timeout?: number,
	): Promise<OcrApiResponse> {
		const headers = await this.buildHeaders(request, requestId);

		return fetchAIResponse<OcrApiResponse>(
			false,
			this.name,
			"v1/ocr",
			headers,
			payload,
			request.env,
			{
				requestTimeout: timeout ?? 100000,
				retryDelay: 500,
				maxAttempts: 2,
				backoff: "exponential",
				responseType: "json",
			},
		);
	}
}
