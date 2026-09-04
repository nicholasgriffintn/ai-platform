export function prepareUserSettingsUpdates(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    nickname: settings.nickname ?? null,
    job_role: settings.job_role ?? null,
    traits: settings.traits ?? null,
    preferences: settings.preferences ?? null,
    tracking_enabled:
      settings.tracking_enabled !== undefined ? (settings.tracking_enabled ? 1 : 0) : null,
    guardrails_enabled:
      settings.guardrails_enabled !== undefined ? (settings.guardrails_enabled ? 1 : 0) : null,
    guardrails_provider: settings.guardrails_provider ?? null,
    bedrock_guardrail_id: settings.bedrock_guardrail_id ?? null,
    bedrock_guardrail_version: settings.bedrock_guardrail_version ?? null,
    embedding_provider: settings.embedding_provider ?? null,
    bedrock_knowledge_base_id: settings.bedrock_knowledge_base_id ?? null,
    bedrock_knowledge_base_custom_data_source_id:
      settings.bedrock_knowledge_base_custom_data_source_id ?? null,
    s3vectors_bucket_name: settings.s3vectors_bucket_name ?? null,
    s3vectors_index_name: settings.s3vectors_index_name ?? null,
    s3vectors_region: settings.s3vectors_region ?? null,
    memories_save_enabled:
      settings.memories_save_enabled !== undefined
        ? settings.memories_save_enabled
          ? 1
          : 0
        : null,
    memories_chat_history_enabled:
      settings.memories_chat_history_enabled !== undefined
        ? settings.memories_chat_history_enabled
          ? 1
          : 0
        : null,
    temporary_chats_default:
      settings.temporary_chats_default !== undefined
        ? settings.temporary_chats_default
          ? 1
          : 0
        : null,
    memory_provider: settings.memory_provider ?? null,
    transcription_provider: settings.transcription_provider ?? null,
    transcription_model: settings.transcription_model ?? null,
    speech_provider: settings.speech_provider ?? null,
    speech_model: settings.speech_model ?? null,
    search_provider: settings.search_provider ?? null,
    sandbox_model: settings.sandbox_model ?? null,
    pet_source: settings.pet_source ?? null,
    pet_id: settings.pet_id ?? null,
    pet_travel_enabled:
      settings.pet_travel_enabled !== undefined ? (settings.pet_travel_enabled ? 1 : 0) : null,
    pet_animation_enabled:
      settings.pet_animation_enabled !== undefined
        ? settings.pet_animation_enabled
          ? 1
          : 0
        : null,
    pet_model_overrides:
      settings.pet_model_overrides !== undefined
        ? JSON.stringify(settings.pet_model_overrides)
        : null,
  };

  for (const field of Object.keys(updates)) {
    if (!Object.hasOwn(settings, field) || settings[field] === undefined) {
      delete updates[field];
    }
  }

  return updates;
}
