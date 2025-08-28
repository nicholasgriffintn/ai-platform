export interface User {
  id: string;
  name: string;
  github_username: string;
  email?: string;
  plan_id: "free" | "pro";
  avatar_url: string;
  created_at: string;
  updated_at: string;
  company: string;
  location: string;
  site: string;
  twitter_username: string;
  github_url: string;
  bio: string;
  message_count?: number;
  daily_message_count?: number;
  daily_reset?: string | null;
  daily_pro_message_count?: number;
  daily_pro_reset?: string | null;
  last_active_at?: string | null;
}

export interface UserSettings {
  id: string;
  nickname: string;
  job_role: string;
  traits: string;
  preferences: string;
  guardrails_enabled?: boolean;
  guardrails_provider?: string;
  bedrock_guardrail_id?: string;
  bedrock_guardrail_version?: string;
  embedding_provider?: string;
  bedrock_knowledge_base_id?: string;
  bedrock_knowledge_base_custom_data_source_id?: string;
  s3vectors_bucket_name?: string;
  s3vectors_index_name?: string;
  s3vectors_region?: string;
  memories_save_enabled?: boolean;
  memories_chat_history_enabled?: boolean;
  transcription_provider?: string;
  transcription_model?: string;
}
