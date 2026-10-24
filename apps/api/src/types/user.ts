import type {
  AgeCheckResult,
  ComputeSite,
  GuardrailsProviderId,
  LastModelSelection,
  ModelTier,
  PetModelOverrides,
  ResponseStyleSettings,
  SavedSpeechVoice,
  SpeechProvider,
  ToolRule,
} from "@ngriffin_uk/polychat-schemas";

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
  age_check?: AgeCheckResult | null;
  age_checked_at?: string | null;
  plan_id: string | null;
  message_count?: number;
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
  guardrails_provider: GuardrailsProviderId;
  bedrock_guardrail_id: string | null;
  bedrock_guardrail_version: string | null;
  embedding_provider: string;
  bedrock_knowledge_base_id: string | null;
  bedrock_knowledge_base_custom_data_source_id: string | null;
  bedrock_agent_runtime_arn?: string | null;
  bedrock_agent_role_arn?: string | null;
  s3vectors_bucket_name: string | null;
  s3vectors_index_name: string | null;
  s3vectors_region: string | null;
  dynamodb_vectors_table_name?: string | null;
  dynamodb_vectors_index_name?: string | null;
  dynamodb_vectors_region?: string | null;
  nickname: string | null;
  job_role: string | null;
  location: string | null;
  traits: string | null;
  preferences: string | null;
  response_style: ResponseStyleSettings;
  memories_save_enabled: boolean;
  memories_chat_history_enabled: boolean;
  temporary_chats_default: boolean;
  web_search_enabled: boolean;
  source_search_enabled: boolean;
  memory_provider: string;
  transcription_provider: string;
  transcription_model: string;
  transcription_vocabulary: string[];
  speech_provider: SpeechProvider | null;
  speech_model: string | null;
  speech_voice: string | null;
  speech_expressiveness: number | null;
  speech_voices: SavedSpeechVoice[];
  search_provider: string | null;
  tracking_enabled: boolean;
  advertise_machines: boolean;
  sandbox_model: string | null;
  default_model_tier: ModelTier | null;
  default_model_id: string | null;
  default_compute_site: ComputeSite | null;
  last_model_selection?: LastModelSelection | null;
  pet_source: "preset" | "custom" | null;
  pet_id: string | null;
  pet_travel_enabled: boolean;
  pet_animation_enabled: boolean;
  pet_model_overrides: PetModelOverrides;
  tool_rules: ToolRule[];
  onboarding_seen: string[];
}

export interface UserSettings {
  id: string;
  user_id: number;
  nickname: string | null;
  job_role: string | null;
  location: string | null;
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
