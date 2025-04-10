export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMode = "remote" | "local" | "tool";

export type ResponseMode = "normal" | "concise" | "explanatory" | "formal";

export interface ChatSettings {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  useRAG?: boolean;
  responseMode?: ResponseMode;
  localOnly?: boolean;
  enabledTools?: string[];
  ragOptions?: {
    topK?: number;
    scoreThreshold?: number;
    includeMetadata?: boolean;
    type?: string;
    namespace?: string;
  };
}

export interface MessageContent {
  type: "text" | "image_url" | "artifact" | "document_url" | "thinking";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
  document_url?: {
    url: string;
    name?: string;
  };
  artifact?: {
    identifier: string;
    type: string;
    language?: string;
    title?: string;
    content: string;
  };
  thinking?: string;
  signature?: string;
}

export type Attachment = {
  type: "image" | "document";
  url: string;
  detail?: "low" | "high";
  name?: string;
  isMarkdown?: boolean;
};

export interface MessageData {
  responseType?: "table" | "json" | "text" | "template" | "custom";
  responseDisplay?: {
    fields?: {
      key: string;
      label: string;
    }[];
    template?: string;
  };
  icon?: string;
  formattedName?: string;
  attachments?: Attachment[];
  searchGrounding?: {
    searchEntryPoint?: {
      renderedContent: string;
    };
    groundingChunks?: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
    groundingSupports?: Array<{
      segment: {
        startIndex: number;
        endIndex: number;
        text: string;
      };
      groundingChunkIndices: number[];
      confidenceScores: number[];
    }>;
    webSearchQueries?: string[];
  };
}

export interface Message {
  completion_id?: string;
  role: ChatRole;
  content: string | MessageContent[];
  reasoning?: {
    collapsed: boolean;
    content: string;
  };
  id: string;
  created?: number;
  timestamp?: number;
  model?: string;
  platform?: string;
  citations?: string[] | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    promptTokenCount: number;
    candidatesTokensDetails: {
      modality: string;
      tokenCount: number;
    }[];
    candidatesTokenCount: number;
    totalTokenCount: number;
    promptTokensDetails: {
      modality: string;
      tokenCount: number;
    }[];
  };
  log_id?: string;
  name?: string;
  tool_calls?: {
    id?: string;
    function: {
      name: string;
      arguments:
        | string
        | {
            [key: string]: string;
          };
    };
    index?: number;
  }[];
  status?: string;
  data?: MessageData | Record<string, any>;
}

export interface Conversation {
  id?: string;
  title: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
  last_message_at?: string;
  isLocalOnly?: boolean;
  is_public?: boolean;
  share_id?: string;
}
