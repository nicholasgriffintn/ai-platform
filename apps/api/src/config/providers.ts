/** Provider allow-lists for the media generation tools. */
export const IMAGE_PROVIDERS = ["workers-ai", "replicate"] as const;
export const VIDEO_PROVIDERS = ["workers-ai", "replicate"] as const;
export const SPEECH_PROVIDERS = ["workers-ai", "replicate"] as const;
export const MUSIC_PROVIDERS = ["workers-ai", "replicate", "elevenlabs"] as const;

/** Speech providers the platform hosts itself, as opposed to user-supplied BYOK providers. */
export const PLATFORM_HOSTED_SPEECH_PROVIDERS: readonly string[] = ["melotts"];
