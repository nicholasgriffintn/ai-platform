import type { SavedSpeechVoice } from "./audio.js";
import type { ComputeSite } from "./compute-sites.js";
import type { ModelTier } from "./model-lineup.js";
import type { PetModelOverrides } from "./pets.js";
import type { ResponseStyleSettings } from "./response-style.js";
import type { SpeechProvider } from "./speech-voices.js";
import type { ToolRule } from "./tool-rules.js";
import type { GuardrailsProviderId, LastModelSelection } from "./user/userSettings.js";

export interface User {
  id: number;
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
  last_active_at?: string | null;
  role?: "user" | "admin" | "moderator" | null;
}

export interface AnonymousUser {
  id: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string | null;
  captcha_verified?: number;
}

export interface UserSettings {
  id: string;
  nickname: string;
  job_role: string;
  location: string;
  traits: string;
  preferences: string;
  response_style?: ResponseStyleSettings;
  tracking_enabled?: boolean;
  advertise_machines?: boolean;
  share_machines_with_work?: boolean;
  guardrails_enabled?: boolean;
  guardrails_provider?: GuardrailsProviderId;
  bedrock_guardrail_id?: string;
  bedrock_guardrail_version?: string;
  embedding_provider?: string;
  bedrock_knowledge_base_id?: string;
  bedrock_knowledge_base_custom_data_source_id?: string;
  bedrock_agent_runtime_arn?: string;
  bedrock_agent_role_arn?: string;
  s3vectors_bucket_name?: string;
  s3vectors_index_name?: string;
  s3vectors_region?: string;
  dynamodb_vectors_table_name?: string;
  dynamodb_vectors_index_name?: string;
  dynamodb_vectors_region?: string;
  memories_save_enabled?: boolean;
  memories_chat_history_enabled?: boolean;
  temporary_chats_default?: boolean;
  web_search_enabled?: boolean;
  source_search_enabled?: boolean;
  memory_provider?: string;
  transcription_provider?: string;
  transcription_model?: string;
  transcription_vocabulary?: string[];
  speech_provider?: SpeechProvider | null;
  speech_model?: string | null;
  speech_voice?: string | null;
  speech_expressiveness?: number | null;
  speech_voices?: SavedSpeechVoice[];
  search_provider?: string;
  sandbox_model?: string;
  default_model_tier?: ModelTier | null;
  default_model_id?: string | null;
  default_compute_site?: ComputeSite | null;
  last_model_selection?: LastModelSelection | null;
  pet_source?: "preset" | "custom";
  pet_id?: string;
  pet_travel_enabled?: boolean;
  pet_animation_enabled?: boolean;
  pet_model_overrides?: PetModelOverrides;
  tool_rules?: ToolRule[];
  onboarding_seen?: string[];
}
