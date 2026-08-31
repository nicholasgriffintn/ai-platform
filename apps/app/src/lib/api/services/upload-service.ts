import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  MarkdownConversionOptions,
  TranscriptionResponse,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper";

export interface UploadFileOptions {
  convertToMarkdown?: boolean;
  conversionOptions?: MarkdownConversionOptions;
  projectId?: string;
}

export class UploadService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse> {
    const headers = await this.getHeaders();

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

    return await returnFetchedData<TranscriptionResponse>(response);
  }

  async uploadFile(
    file: File,
    fileType: "image" | "document" | "audio" | "code",
    options?: UploadFileOptions,
  ): Promise<{
    sourceId: string;
    key: string;
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

    if (options?.conversionOptions) {
      formData.append("conversion_options", JSON.stringify(options.conversionOptions));
    }

    if (options?.projectId) {
      formData.append("project_id", options.projectId);
    }

    const response = await fetchApi("/uploads", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      const errorMessage =
        typeof errorData === "object" && errorData !== null && "error" in errorData
          ? String(errorData.error)
          : response.statusText;

      throw new Error(`Failed to upload file: ${errorMessage}`);
    }

    return await returnFetchedData<any>(response);
  }
}
