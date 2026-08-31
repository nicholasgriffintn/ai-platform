import type {
  ConversationActivityWindow as SchemaConversationActivityWindow,
  ConversationArchiveFilter as SchemaConversationArchiveFilter,
  ConversationSortBy as SchemaConversationSortBy,
  ConversationType as SchemaConversationType,
  MessagePart as SchemaMessagePart,
  ToolResponseType,
  SandboxTaskType,
  ChatCompletionRequestBody as SchemaChatCompletionRequestBody,
  ChatHostedToolSettings as SchemaHostedToolSettings,
  ConversationModeMetadata,
  MessageRole as SchemaMessageRole,
  ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";

export type ChatRole = SchemaMessageRole;

export type VerbosityLevel = "low" | "medium" | "high" | "caveman";

export interface ChatReasoningSettings {
  effort?: ReasoningEffort;
}

export type HostedToolSettings = SchemaHostedToolSettings;

export interface ChatSettings {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  compaction?: SchemaChatCompletionRequestBody["compaction"];
  localOnly?: boolean;
  enabled_tools?: string[];
  reasoning?: ChatReasoningSettings;
  verbosity?: VerbosityLevel;
  tool_options?: HostedToolSettings;
}

export type ChatRequestOptions = Partial<SchemaChatCompletionRequestBody>;

export interface MessageContent {
  type:
    | "text"
    | "image_url"
    | "audio_url"
    | "video_url"
    | "input_audio"
    | "artifact"
    | "document_url"
    | "markdown_document"
    | "artifact_selection"
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
  markdown_document?: {
    markdown: string;
    name?: string;
  };
  artifact_selection?: {
    artifact: {
      identifier: string;
      type: string;
      title?: string;
    };
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
  };
  artifact?: {
    identifier: string;
    type: string;
    language?: string;
    title?: string;
    display?: "panel" | "inline";
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
  conversationMode?: ConversationModeMetadata;
  codingTaskType?: SandboxTaskType;
  responseType?: ToolResponseType;
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
    id: string;
    type?: string;
    poll?: {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: Record<string, any>;
      query?: Record<string, string>;
      intervalMs?: number;
    };
    pollIntervalMs?: number;
    status?: string;
    lastCheckedAt?: number;
    completedAt?: number;
    initialResponse?: Record<string, any>;
    context?: Record<string, any>;
    contentHints?: {
      placeholder?: MessageContent[];
      progress?: MessageContent[];
      failure?: MessageContent[];
    };
    [key: string]: any;
  };
  opinion?: {
    mode: "second-opinion" | "consensus";
    sourceMessageId: string;
    modelIds: string[];
  };
  speech?: {
    audioOutputId?: string;
    audioKey?: string;
    audioUrl?: string;
    audioDataUrl?: string;
    audioBase64?: string;
    audioMimeType?: string;
    provider?: string;
    model?: string;
    generatedAt: number;
  };
  error?: string;
}

export interface MessageUsage extends Record<string, unknown> {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  costUsd?: number;
  estimated_cost_usd?: number;
  estimatedCostUsd?: number;
  promptTokenCount?: number;
  candidatesTokensDetails?: {
    modality: string;
    tokenCount: number;
  }[];
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: {
    modality: string;
    tokenCount: number;
  }[];
}

export interface Message {
  completion_id?: string;
  role: ChatRole;
  content: string | MessageContent[] | Record<string, unknown>;
  parts?: SchemaMessagePart[];
  reasoning?: {
    collapsed: boolean;
    content: string;
  };
  id: string;
  created?: number;
  timestamp?: number;
  model?: string;
  provider?: string;
  platform?: string;
  mode?: string;
  citations?: string[] | null;
  usage?: MessageUsage;
  log_id?: string;
  name?: string;
  tool_call_id?: string;
  tool_call_arguments?: string | Record<string, any>;
  tool_calls?: {
    id?: string;
    type?: "function";
    function: {
      name: string;
      arguments: string | Record<string, unknown>;
    };
    index?: number;
  }[];
  status?: string;
  data?: MessageData | Record<string, any>;
}

export interface Conversation {
  id?: string;
  type?: SchemaConversationType;
  title: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
  last_message_at?: string;
  parent_conversation_id?: string;
  parent_message_id?: string;
  project_id?: string | null;
  isLocalOnly?: boolean;
  localOwnerScope?: string;
  is_public?: boolean;
  share_id?: string;
  is_archived?: boolean;
}

export type ConversationArchiveFilter = SchemaConversationArchiveFilter;
export type ConversationSortBy = SchemaConversationSortBy;
export type ConversationActivityWindow = SchemaConversationActivityWindow;
export type ConversationType = SchemaConversationType;

export interface ConversationListOptions {
  activity?: ConversationActivityWindow;
  archived?: ConversationArchiveFilter;
  limit?: number;
  page?: number;
  query?: string;
  sortBy?: ConversationSortBy;
}

export interface ConversationListPage {
  conversations: Conversation[];
  pageNumber: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Memory {
  id: string;
  text: string;
  category: string;
  created_at: string;
  group_id: string | null;
  group_title: string | null;
  provenance?: {
    provider: string;
    source: string;
    conversation_id?: string | null;
    connector_provider?: string;
  };
  scope?: string;
  namespace?: string;
  ttl?: {
    expires_at: string | null;
  };
  lifecycle?: {
    is_active: boolean;
    importance_score: number;
    last_accessed?: string | null;
    updated_at?: string | null;
  };
}

export interface MemoryGroup {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  member_count: number;
  created_at: string;
}
