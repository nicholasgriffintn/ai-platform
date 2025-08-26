export interface User {
  id: number;
  name: string | null;
  avatar_url: string | null;
  email: string;
  github_username: string | null;
  company: string | null;
  site: string | null;
  location: string | null;
  bio: string | null;
  twitter_username: string | null;
  role?: string | null;
  created_at: string;
  updated_at: string;
  setup_at: string | null;
  terms_accepted_at: string | null;
  plan_id: string | null;
  message_count?: number;
  daily_message_count?: number;
  daily_reset?: string | null;
  daily_pro_message_count?: number;
  daily_pro_reset?: string | null;
  last_active_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export interface IUser extends User {
  longitude?: number;
  latitude?: number;
}

export interface IUserSettings {
  guardrails_enabled: boolean;
  guardrails_provider: string;
  bedrock_guardrail_id: string | null;
  bedrock_guardrail_version: string | null;
  embedding_provider: string;
  bedrock_knowledge_base_id: string | null;
  bedrock_knowledge_base_custom_data_source_id: string | null;
  s3vectors_bucket_name: string | null;
  s3vectors_index_name: string | null;
  s3vectors_region: string | null;
  nickname: string | null;
  job_role: string | null;
  traits: string | null;
  preferences: string | null;
  memories_save_enabled: boolean;
  memories_chat_history_enabled: boolean;
}

export interface UserSettings {
  id: string;
  user_id: number;
  nickname: string | null;
  job_role: string | null;
  traits: string | null;
  preferences: string | null;
  tracking_enabled: boolean;
  public_key: string | null;
  private_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelSettings {
  id: string;
  user_id: number;
  model_id: string;
  enabled: boolean;
  api_key: string | null;
  created_at: string;
  updated_at: string;
}
