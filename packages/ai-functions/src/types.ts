import type {
  ChatCompletionParameters,
  Message,
  MessageContent,
  ProviderEnv,
  ProviderUser,
} from "@ngriffin_uk/polychat-ai-providers";

export interface AiRequestScope {
  env: ProviderEnv;
  user?: ProviderUser;
  completion_id?: string;
  app_url?: string;
}

export type CompletionOverrides = Omit<
  Partial<ChatCompletionParameters>,
  "env" | "messages" | "context" | "model" | "provider"
>;

export interface CompletionRequest extends AiRequestScope, CompletionOverrides {
  model?: string;
  provider?: string;
  messages?: Message[];
  prompt?: string;
  system?: string;
}

export interface CompletionMetadata {
  id?: string;
  logId?: string;
  citations?: unknown[];
  usage?: unknown;
}

export interface CompletionResult<TRaw = unknown> extends CompletionMetadata {
  text: string;
  model: string;
  provider: string;
  raw: TRaw;
}

export interface StructuredResult<TObject, TRaw = unknown> extends CompletionResult<TRaw> {
  object: TObject;
}

export type CompletionMessageContent = string | MessageContent[];
