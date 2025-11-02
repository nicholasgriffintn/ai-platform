export interface ResearchCitation {
  title?: string | null;
  url?: string | null;
  excerpts?: string[];
}

export interface ResearchFieldBasis {
  field: string;
  reasoning?: string;
  confidence?: string;
  citations?: ResearchCitation[];
}

export interface ResearchOutput {
  content: unknown;
  basis?: ResearchFieldBasis[];
  type?: string;
}

export interface ResearchRun {
  run_id: string;
  status: string;
  is_active: boolean;
  warnings?: string[] | null;
  processor: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  modified_at: string;
  error?: string | null;
  taskgroup_id?: string | null;
}

export interface ResearchPollMetadata {
  interval_ms?: number;
  timeout_seconds?: number;
  attempts?: number;
  elapsed_ms?: number;
}

export interface ResearchStatus {
  provider: string;
  run: ResearchRun;
  output?: ResearchOutput;
  warnings?: string[] | null;
  poll?: ResearchPollMetadata;
}
