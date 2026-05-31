import { isRecord } from "../utils/objects.js";

export interface HuggingFaceHubModelFile {
	path: string;
	size?: number;
	url: string;
}

interface HuggingFaceHubOptions {
	token?: string;
	fetcher?: typeof fetch;
}

const HUGGINGFACE_BASE_URL = "https://huggingface.co";
const HUGGINGFACE_API_BASE_URL = `${HUGGINGFACE_BASE_URL}/api/models`;

export class HuggingFaceHub {
	private readonly fetcher: typeof fetch;

	constructor(private readonly options: HuggingFaceHubOptions = {}) {
		this.fetcher = options.fetcher || fetch;
	}

	async listModelFiles(modelId: string): Promise<HuggingFaceHubModelFile[]> {
		const response = await this.fetcher(`${HUGGINGFACE_API_BASE_URL}/${encodePath(modelId)}`, {
			headers: this.getAuthHeaders(),
		});
		if (!response.ok) {
			throw new Error(`Hugging Face model lookup failed (${response.status}) for ${modelId}`);
		}

		const body: unknown = await response.json();
		if (!isRecord(body) || !Array.isArray(body.siblings)) {
			throw new Error(`Hugging Face model lookup did not return files for ${modelId}`);
		}

		const files = body.siblings.flatMap((sibling): HuggingFaceHubModelFile[] => {
			if (!isRecord(sibling) || typeof sibling.rfilename !== "string") return [];
			if (!shouldStageModelFile(sibling.rfilename)) return [];

			return [
				{
					path: sibling.rfilename,
					size: typeof sibling.size === "number" ? sibling.size : undefined,
					url: this.getModelFileUrl(modelId, sibling.rfilename),
				},
			];
		});

		if (files.length === 0) {
			throw new Error(`Hugging Face model ${modelId} did not expose importable files`);
		}

		return files;
	}

	async downloadModelFile(file: HuggingFaceHubModelFile): Promise<Response> {
		const response = await this.fetcher(file.url, {
			headers: this.getAuthHeaders(),
		});
		if (!response.ok) {
			throw new Error(
				`Hugging Face model file download failed (${response.status}) for ${file.path}`,
			);
		}

		return response;
	}

	private getModelFileUrl(modelId: string, filePath: string): string {
		return `${HUGGINGFACE_BASE_URL}/${encodePath(modelId)}/resolve/main/${encodePath(filePath)}`;
	}

	private getAuthHeaders(): HeadersInit | undefined {
		return this.options.token ? { Authorization: `Bearer ${this.options.token}` } : undefined;
	}
}

function shouldStageModelFile(path: string): boolean {
	const filename = path.split("/").at(-1);
	return Boolean(filename && filename !== ".gitattributes");
}

function encodePath(value: string): string {
	return value.split("/").map(encodeURIComponent).join("/");
}
