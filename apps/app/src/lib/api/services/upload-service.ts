import { fetchApi } from "../fetch-wrapper";

export class UploadService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async transcribeAudio(audioBlob: Blob): Promise<any> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error transcribing audio:", error);
		}

		const formData = new FormData();
		formData.append("audio", audioBlob);

		const response = await fetchApi("/audio/transcribe", {
			method: "POST",
			headers,
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Failed to transcribe audio: ${response.statusText}`);
		}

		return await response.json();
	}

	async uploadFile(
		file: File,
		fileType: "image" | "document" | "audio" | "code",
		options?: { convertToMarkdown?: boolean },
	): Promise<{
		url: string;
		type: string;
		name: string;
		markdown?: string;
	}> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error uploading file:", error);
		}

		const formData = new FormData();
		formData.append("file", file);
		formData.append("file_type", fileType);

		if (options?.convertToMarkdown) {
			formData.append("convert_to_markdown", "true");
		}

		const response = await fetchApi("/uploads", {
			method: "POST",
			headers,
			body: formData,
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			const errorMessage =
				typeof errorData === "object" &&
				errorData !== null &&
				"error" in errorData
					? String(errorData.error)
					: response.statusText;
			throw new Error(`Failed to upload file: ${errorMessage}`);
		}

		return await response.json();
	}
}
