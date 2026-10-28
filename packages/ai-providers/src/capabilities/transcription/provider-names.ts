const TRANSCRIPTION_PROVIDER_BY_MODEL_PROVIDER: Record<string, string> = {
  "workers-ai": "workers",
};

export function toTranscriptionProvider(modelProvider: string): string {
  return TRANSCRIPTION_PROVIDER_BY_MODEL_PROVIDER[modelProvider] ?? modelProvider;
}
