export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMode = "remote" | "local" | "tool" | "agent";

export type ResponseMode = "normal" | "concise" | "explanatory" | "formal";

export interface ChatSettings {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  use_rag?: boolean;
  response_mode?: ResponseMode;
  localOnly?: boolean;
  enabled_tools?: string[];
  rag_options?: {
    topK?: number;
    scoreThreshold?: number;
    includeMetadata?: boolean;
    type?: string;
    namespace?: string;
  };
}

export interface MessageContent {
  type:
    | "text"
    | "image_url"
    | "audio_url"
    | "video_url"
    | "input_audio"
    | "artifact"
    | "document_url"
    | "thinking";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
  audio_url?: {
    url: string;
  };
  video_url?: {
    url: string;
  };
  input_audio?: {
    data?: string;
    format?: "wav" | "mp3";
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

export interface Attachment {
  type: "image" | "document" | "audio" | "code" | "markdown_document";
  url: string;
  detail?: "low" | "high";
  name?: string;
  isMarkdown?: boolean;
}

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
  asyncInvocation?: {
    provider: string;
    invocationArn: string;
    invocationUrl?: string;
    pollIntervalMs?: number;
    status?: string;
    lastCheckedAt?: number;
    completedAt?: number;
    [key: string]: any;
  };
  error?: string;
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
  parent_conversation_id?: string;
  parent_message_id?: string;
  isLocalOnly?: boolean;
  is_public?: boolean;
  share_id?: string;
}

export interface Memory {
  id: string;
  text: string;
  category: string;
  created_at: string;
  group_id: string | null;
  group_title: string | null;
}

export interface MemoryGroup {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  member_count: number;
  created_at: string;
}
