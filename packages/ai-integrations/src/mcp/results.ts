import z from "zod/v4";

import type { McpToolCallResult } from "./contracts.js";

export const MCP_RESULT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export interface McpResultImage {
  mimeType: string;
  data: string;
}

export interface FormattedMcpToolResult {
  text: string;
  images: McpResultImage[];
  isError: boolean;
  truncated: boolean;
}

export interface McpResultImageOptions {
  maxImages: number;
  maxImageBytes: number;
}

const imageBlockSchema = z.object({
  type: z.literal("image"),
  data: z.string().min(1),
  mimeType: z.string(),
});

function decodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function readImage(
  block: McpToolCallResult["content"][number],
  options: McpResultImageOptions | undefined,
  kept: number,
): { image?: McpResultImage; placeholder: string } {
  const parsed = imageBlockSchema.safeParse(block);

  if (!parsed.success || !options) {
    return { placeholder: `[${block.type} content omitted]` };
  }

  const { data, mimeType } = parsed.data;

  if (!MCP_RESULT_IMAGE_TYPES.some((type) => type === mimeType)) {
    return { placeholder: `[image omitted: ${mimeType} is not a supported image type]` };
  }

  if (decodedBytes(data) > options.maxImageBytes) {
    return { placeholder: "[image omitted: too large]" };
  }

  if (kept >= options.maxImages) {
    return { placeholder: "[image omitted: image limit reached]" };
  }

  return { image: { mimeType, data }, placeholder: `[image ${kept + 1} attached]` };
}

export function formatMcpToolResult(
  result: McpToolCallResult,
  maxChars: number,
  imageOptions?: McpResultImageOptions,
): FormattedMcpToolResult {
  const images: McpResultImage[] = [];
  const blocks = result.content.map((block) => {
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }

    const { image, placeholder } = readImage(block, imageOptions, images.length);

    if (image) {
      images.push(image);
    }

    return placeholder;
  });
  const raw =
    blocks.length > 0
      ? blocks.join("\n")
      : result.structuredContent === undefined
        ? ""
        : JSON.stringify(result.structuredContent);

  return {
    text: raw.slice(0, maxChars) || "(the tool returned no content)",
    images,
    isError: result.isError === true,
    truncated: raw.length > maxChars,
  };
}
