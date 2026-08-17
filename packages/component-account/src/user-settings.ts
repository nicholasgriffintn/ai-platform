export interface UserSettings {
	id: string;
	nickname: string;
	job_role: string;
	traits: string;
	preferences: string;
	tracking_enabled?: boolean;
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
	temporary_chats_default?: boolean;
	memory_provider?: string;
	transcription_provider?: string;
	transcription_model?: string;
	speech_provider?: string;
	speech_model?: string;
	search_provider?: string;
	sandbox_model?: string;
}
