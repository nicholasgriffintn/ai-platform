export interface NLPTask {
  text: string;
  operations: string[];
}

export interface NLPContainerResponse {
  success: boolean;
  data?: {
    sentiment?: any;
    entities?: any[];
    summary?: string;
    language?: any;
  };
  error?: string;
  processing_time_ms: number;
}
