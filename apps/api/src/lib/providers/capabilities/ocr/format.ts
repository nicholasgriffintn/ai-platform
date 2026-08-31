import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { convertMarkdownToHtml } from "~/utils/markdown";
import { escapeRegExp, getUtf8ByteLength } from "~/utils/strings";

import type {
  OcrBlock,
  OcrBlockType,
  OcrNormalisedResponse,
  OcrOutputFormat,
  OcrPageConfidenceScores,
  OcrWordConfidenceScore,
} from "./types";

export interface OcrImage {
  id: string;
  top_left_x: number | null;
  top_left_y: number | null;
  bottom_right_x: number | null;
  bottom_right_y: number | null;
  image_base64?: string | null;
  image_annotation?: string | null;
}

export interface OcrConfidenceScore {
  text: string;
  confidence: number;
  start_index: number;
}

export interface OcrTable {
  id: string;
  content: string;
  format: "markdown" | "html";
  word_confidence_scores?: OcrConfidenceScore[] | null;
}

export interface OcrBlockConfidenceScores {
  average_content_confidence_score?: number | null;
  minimum_content_confidence_score?: number | null;
  block_type_confidence_score?: number | null;
}

export interface OcrApiBlock {
  type: OcrBlockType;
  top_left_x: number;
  top_left_y: number;
  bottom_right_x: number;
  bottom_right_y: number;
  content: string;
  confidence_scores?: OcrBlockConfidenceScores | null;
  image_id?: string;
  table_id?: string | null;
}

export interface OcrPage {
  index: number;
  markdown: string;
  images: OcrImage[];
  tables?: OcrTable[];
  hyperlinks?: string[];
  header?: string | null;
  footer?: string | null;
  dimensions?: {
    dpi: number;
    height: number;
    width: number;
  } | null;
  confidence_scores?: {
    word_confidence_scores?: OcrConfidenceScore[];
    average_page_confidence_score: number;
    minimum_page_confidence_score: number;
  } | null;
  blocks?: OcrApiBlock[] | null;
}

export interface OcrApiResponse {
  model: string;
  data?: {
    model?: string;
  };
  pages: OcrPage[];
  document_annotation?: string | null;
  usage_info: {
    pages_processed: number;
    doc_size_bytes?: number | null;
  };
  eventId?: string;
  log_id?: string;
  cacheStatus?: string;
}

export interface PersistedOcrOutput {
  outputId: string;
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
  projectId?: string;
  conversationId?: string;
  parentOutputId?: string;
}

export function buildOcrStorageKey(params: {
  ownerUserId: number;
  projectId?: string;
  requestId: string;
  extension: "html" | "json" | "md" | "txt";
}): string {
  const scope = params.projectId
    ? `projects/${encodeURIComponent(params.projectId)}`
    : `users/${params.ownerUserId}`;

  return `ocr/${scope}/${encodeURIComponent(params.requestId)}/output.${params.extension}`;
}

function buildHtmlDocument(markdown: string): string {
  const rendered = convertMarkdownToHtml(escapeHtml(markdown)).replace(
    /\s(?:href|src)="(?!https?:|mailto:|data:image\/|#)[^"]*"/gi,
    "",
  );

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
        pre { background-color: #f5f5f5; padding: 16px; overflow: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
${rendered}
</body>
</html>`;
}

function collectImages(pages: OcrPage[]): Map<string, string> {
  const images = new Map<string, string>();

  for (const page of pages) {
    for (const image of page.images ?? []) {
      if (typeof image.image_base64 === "string") {
        images.set(image.id, image.image_base64);
      }
    }
  }

  return images;
}

export function buildOcrMarkdown(response: OcrApiResponse): string {
  const pages = response.pages;
  const images = collectImages(pages);
  const tables = new Map(
    pages.flatMap((page) => (page.tables ?? []).map((table) => [table.id, table.content] as const)),
  );
  const pageContent = pages.map((page) => {
    let content = page.markdown;

    for (const [imageId, imageBase64] of images) {
      const imagePattern = new RegExp(`!\\[(.*?)\\]\\(${escapeRegExp(imageId)}\\)`, "g");

      content = content.replace(imagePattern, (_match, alt: string) => `![${alt}](${imageBase64})`);
    }

    for (const [tableId, tableContent] of tables) {
      const tablePattern = new RegExp(`\\[(.*?)\\]\\(${escapeRegExp(tableId)}\\)`, "g");

      content = content.replace(tablePattern, tableContent);
    }

    return [page.header, content, page.footer].filter(Boolean).join("\n\n");
  });

  return pageContent.length ? `${pageContent.join("\n\n")}\n\n` : "";
}

export function getOcrResponseModel(response: OcrApiResponse): string | undefined {
  return response.model ?? response.data?.model;
}

function normaliseWordConfidenceScore(score: OcrConfidenceScore): OcrWordConfidenceScore {
  return {
    text: score.text,
    confidence: score.confidence,
    startIndex: score.start_index,
  };
}

function normalisePageConfidenceScores(
  scores: NonNullable<OcrPage["confidence_scores"]>,
): OcrPageConfidenceScores {
  return {
    averagePageConfidenceScore: scores.average_page_confidence_score,
    minimumPageConfidenceScore: scores.minimum_page_confidence_score,
    wordConfidenceScores: (scores.word_confidence_scores ?? []).map(normaliseWordConfidenceScore),
  };
}

function normaliseBlock(block: OcrApiBlock): OcrBlock {
  return {
    type: block.type,
    boundingBox: {
      topLeftX: block.top_left_x,
      topLeftY: block.top_left_y,
      bottomRightX: block.bottom_right_x,
      bottomRightY: block.bottom_right_y,
    },
    content: block.content,
    ...(block.confidence_scores
      ? {
          confidenceScores: {
            averageContentConfidenceScore:
              block.confidence_scores.average_content_confidence_score ?? null,
            minimumContentConfidenceScore:
              block.confidence_scores.minimum_content_confidence_score ?? null,
            blockTypeConfidenceScore: block.confidence_scores.block_type_confidence_score ?? null,
          },
        }
      : {}),
    ...(block.image_id ? { imageId: block.image_id } : {}),
    ...(block.table_id !== undefined ? { tableId: block.table_id } : {}),
  };
}

function normaliseTable(table: OcrTable) {
  const wordConfidenceScores = table.word_confidence_scores?.map(normaliseWordConfidenceScore);

  return {
    id: table.id,
    content: table.content,
    format: table.format,
    ...(table.word_confidence_scores !== undefined ? { wordConfidenceScores } : {}),
  };
}

export function normaliseOcrResponse(response: OcrApiResponse): OcrNormalisedResponse {
  return {
    model: response.model,
    pages: response.pages.map((page) => ({
      index: page.index,
      markdown: page.markdown,
      images: page.images.map((image) => ({
        id: image.id,
        boundingBox: {
          topLeftX: image.top_left_x,
          topLeftY: image.top_left_y,
          bottomRightX: image.bottom_right_x,
          bottomRightY: image.bottom_right_y,
        },
        ...(image.image_base64 !== undefined ? { base64: image.image_base64 } : {}),
        ...(image.image_annotation !== undefined ? { annotation: image.image_annotation } : {}),
      })),
      tables: (page.tables ?? []).map(normaliseTable),
      hyperlinks: page.hyperlinks ?? [],
      ...(page.header !== undefined ? { header: page.header } : {}),
      ...(page.footer !== undefined ? { footer: page.footer } : {}),
      ...(page.dimensions !== undefined ? { dimensions: page.dimensions } : {}),
      ...(page.confidence_scores
        ? { confidenceScores: normalisePageConfidenceScores(page.confidence_scores) }
        : {}),
      ...(page.blocks !== undefined ? { blocks: page.blocks?.map(normaliseBlock) ?? null } : {}),
    })),
    ...(response.document_annotation !== undefined
      ? { documentAnnotation: response.document_annotation }
      : {}),
    usage: {
      pagesProcessed: response.usage_info.pages_processed,
      ...(response.usage_info.doc_size_bytes !== undefined
        ? { documentSizeBytes: response.usage_info.doc_size_bytes }
        : {}),
    },
  };
}

export function buildOcrHtml(response: OcrApiResponse): string {
  return buildHtmlDocument(buildOcrMarkdown(response));
}

export async function persistOcrOutput({
  requestId,
  response,
  outputFormat,
  context,
  ownerUserId,
  projectId,
  conversationId,
  parentOutputId,
}: PersistOcrOutputOptions): Promise<PersistedOcrOutput> {
  const storage = StorageService.forPrivateAssets(context);

  if (outputFormat === "json") {
    const content = JSON.stringify(response);
    const storedOutput = await storage.storeOutputFile({
      key: buildOcrStorageKey({ ownerUserId, projectId, requestId, extension: "json" }),
      data: content,
      createdByUserId: ownerUserId,
      projectId,
      conversationId,
      parentOutputId,
      capabilityId: "ocr",
      groupId: requestId,
      kind: "ocr_output",
      title: "OCR result (JSON)",
      content: { outputFormat },
      mimeType: "application/json",
      filename: "output.json",
      byteSize: getUtf8ByteLength(content),
    });

    return {
      outputId: storedOutput.outputId,
      key: storedOutput.key,
      url: storedOutput.url,
      outputFormat,
    };
  }

  const markdown = buildOcrMarkdown(response);

  if (outputFormat === "html") {
    const html = buildOcrHtml(response);
    const storedOutput = await storage.storeOutputFile({
      key: buildOcrStorageKey({ ownerUserId, projectId, requestId, extension: "html" }),
      data: html,
      createdByUserId: ownerUserId,
      projectId,
      conversationId,
      parentOutputId,
      capabilityId: "ocr",
      groupId: requestId,
      kind: "ocr_output",
      title: "OCR result (HTML)",
      content: { outputFormat },
      mimeType: "text/html",
      filename: "output.html",
      byteSize: getUtf8ByteLength(html),
    });

    return {
      outputId: storedOutput.outputId,
      key: storedOutput.key,
      url: storedOutput.url,
      outputFormat,
    };
  }

  if (outputFormat === "text") {
    const storedOutput = await storage.storeOutputFile({
      key: buildOcrStorageKey({ ownerUserId, projectId, requestId, extension: "txt" }),
      data: markdown,
      createdByUserId: ownerUserId,
      projectId,
      conversationId,
      parentOutputId,
      capabilityId: "ocr",
      groupId: requestId,
      kind: "ocr_output",
      title: "OCR result (Text)",
      content: { outputFormat },
      mimeType: "text/plain",
      filename: "output.txt",
      byteSize: getUtf8ByteLength(markdown),
    });

    return {
      outputId: storedOutput.outputId,
      key: storedOutput.key,
      url: storedOutput.url,
      outputFormat,
    };
  }

  const storedOutput = await storage.storeOutputFile({
    key: buildOcrStorageKey({ ownerUserId, projectId, requestId, extension: "md" }),
    data: markdown,
    createdByUserId: ownerUserId,
    projectId,
    conversationId,
    parentOutputId,
    capabilityId: "ocr",
    groupId: requestId,
    kind: "ocr_output",
    title: "OCR result (Markdown)",
    content: { outputFormat },
    mimeType: "text/markdown",
    filename: "output.md",
    byteSize: getUtf8ByteLength(markdown),
  });

  return {
    outputId: storedOutput.outputId,
    key: storedOutput.key,
    url: storedOutput.url,
    outputFormat,
  };
}
