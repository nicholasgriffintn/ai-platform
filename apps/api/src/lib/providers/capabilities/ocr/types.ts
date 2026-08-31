import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";

export type OcrOutputFormat = "json" | "html" | "markdown" | "text";

export interface OcrDocumentUrl {
  type: "document_url";
  document_url: string;
  document_name?: string;
}

export interface OcrImageUrl {
  type: "image_url";
  image_url: string;
}

export interface OcrFile {
  type: "file";
  file_id: string;
}

export type OcrDocument = OcrDocumentUrl | OcrImageUrl | OcrFile;
export type OcrConfidenceGranularity = "page" | "block" | "word";
export type OcrTableFormat = "markdown" | "html";

export interface OcrJsonSchemaFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface OcrBoundingBox {
  topLeftX: number | null;
  topLeftY: number | null;
  bottomRightX: number | null;
  bottomRightY: number | null;
}

export interface OcrWordConfidenceScore {
  text: string;
  confidence: number;
  startIndex: number;
}

export interface OcrPageConfidenceScores {
  averagePageConfidenceScore: number;
  minimumPageConfidenceScore: number;
  wordConfidenceScores: OcrWordConfidenceScore[];
}

export interface OcrBlockConfidenceScores {
  averageContentConfidenceScore: number | null;
  minimumContentConfidenceScore: number | null;
  blockTypeConfidenceScore: number | null;
}

export type OcrBlockType =
  | "text"
  | "title"
  | "list"
  | "table"
  | "image"
  | "equation"
  | "caption"
  | "code"
  | "references"
  | "aside_text"
  | "header"
  | "footer"
  | "signature";

export interface OcrBlock {
  type: OcrBlockType;
  boundingBox: OcrBoundingBox;
  content: string;
  confidenceScores?: OcrBlockConfidenceScores | null;
  imageId?: string;
  tableId?: string | null;
}

export interface OcrImage {
  id: string;
  boundingBox: OcrBoundingBox;
  base64?: string | null;
  annotation?: string | null;
}

export interface OcrTable {
  id: string;
  content: string;
  format: OcrTableFormat;
  wordConfidenceScores?: OcrWordConfidenceScore[] | null;
}

export interface OcrPageDimensions {
  dpi: number;
  height: number;
  width: number;
}

export interface OcrPageResult {
  index: number;
  markdown: string;
  images: OcrImage[];
  tables: OcrTable[];
  hyperlinks: string[];
  header?: string | null;
  footer?: string | null;
  dimensions?: OcrPageDimensions | null;
  confidenceScores?: OcrPageConfidenceScores | null;
  blocks?: OcrBlock[] | null;
}

export interface OcrNormalisedResponse {
  model: string;
  pages: OcrPageResult[];
  documentAnnotation?: string | null;
  usage: {
    pagesProcessed: number;
    documentSizeBytes?: number | null;
  };
}

export interface OcrExtractionRequest {
  env: IEnv;
  user?: IUser;
  provider?: string;
  model?: string;
  document: OcrDocument;
  id?: string;
  projectId?: string;
  conversationId?: string;
  parentOutputId?: string;
  pages?: number[] | string;
  include_image_base64?: boolean;
  image_limit?: number;
  image_min_size?: number;
  include_blocks?: boolean;
  confidence_scores_granularity?: OcrConfidenceGranularity;
  table_format?: OcrTableFormat;
  extract_header?: boolean;
  extract_footer?: boolean;
  document_annotation_format?: OcrJsonSchemaFormat;
  document_annotation_prompt?: string;
  bbox_annotation_format?: OcrJsonSchemaFormat;
  output_format?: OcrOutputFormat;
  storage?: StorageService;
}

export interface OcrExtractionResult {
  model: string;
  outputId: string;
  key: string;
  url: string;
  outputFormat: OcrOutputFormat;
  extractedText: string;
  response: OcrNormalisedResponse;
}

export interface OcrProvider {
  name: string;
  models?: string[];
  extractText(request: OcrExtractionRequest): Promise<OcrExtractionResult>;
}
