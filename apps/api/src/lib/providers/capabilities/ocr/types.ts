import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";

export type OcrOutputFormat = "json" | "html" | "markdown";

export interface OcrDocument {
	type?: "document_url";
	document_url: string;
	document_name?: string;
}

export interface OcrExtractionRequest {
	env: IEnv;
	user?: IUser;
	provider?: string;
	model?: string;
	document: OcrDocument;
	id?: string;
	pages?: number[];
	include_image_base64?: boolean;
	image_limit?: number;
	image_min_size?: number;
	output_format?: OcrOutputFormat;
	storage?: StorageService;
}

export interface OcrExtractionResult {
	model: string;
	key: string;
	url: string;
	outputFormat: OcrOutputFormat;
}

export interface OcrProvider {
	name: string;
	models?: string[];
	extractText(request: OcrExtractionRequest): Promise<OcrExtractionResult>;
}
