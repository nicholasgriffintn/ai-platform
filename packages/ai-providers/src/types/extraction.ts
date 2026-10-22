import type {
  ExtractionFields,
  ExtractionOptions,
  ExtractionResponse,
} from "@ngriffin_uk/polychat-schemas";

export interface ExtractionRequest {
  state?: string;
  fields: ExtractionFields;
  images?: string[];
  reference_date?: string;
  options?: ExtractionOptions;
  model?: string;
  completion_id?: string;
  conversationId?: string;
}

export interface ExtractionProvider {
  readonly name: string;
  extract(request: ExtractionRequest): Promise<ExtractionResponse>;
}
