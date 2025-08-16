import { performOcr } from "~/services/apps/retrieval/ocr";
import { convertToMarkdownViaCloudflare } from "~/lib/documentConverter";
import type { IEnv, IUser } from "~/types";

export type AttachmentInput = {
  url: string;
  type: "image" | "document" | "markdown_document" | "audio" | "video";
  name?: string;
  size?: number;
  mimeType?: string;
};

export type AttachmentMetadata = Record<string, any>;

export async function generateAttachmentMetadata(
  env: IEnv,
  user: IUser,
  attachment: AttachmentInput,
): Promise<AttachmentMetadata> {
  try {
    if (attachment.type === "image") {
      const ocr = await performOcr(
        {
          document: {
            type: "document_url",
            document_url: attachment.url,
            document_name: attachment.name || "image",
          },
          output_format: "markdown",
        },
        { env, user },
      );
      const textContent = ocr.status === "success" ? ocr.data?.url : undefined;
      return {
        tags: [],
        description: undefined,
        textContentUrl: textContent,
      };
    }

    if (attachment.type === "document") {
      const { result } = await convertToMarkdownViaCloudflare(
        env,
        attachment.url,
        attachment.name,
      );
      return {
        summary: result ? result.slice(0, 300) : undefined,
        textContent: result,
      };
    }

    if (attachment.type === "video") {
      return {
        duration: undefined,
        width: undefined,
        height: undefined,
        thumbnailUrl: undefined,
      };
    }

    if (attachment.type === "audio") {
      return {
        duration: undefined,
      };
    }

    return {};
  } catch {
    return {};
  }
}
