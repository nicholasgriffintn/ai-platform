import z from "zod/v4";

export const SPEECH_PROVIDERS = [
  "elevenlabs",
  "cartesia",
  "mistral",
  "polly",
  "workers-ai",
] as const;
export const speechProviderSchema = z.enum(SPEECH_PROVIDERS);
export type SpeechProvider = z.infer<typeof speechProviderSchema>;

export const speechModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: speechProviderSchema,
  arenaScore: z.number().nullable(),
});
export type SpeechModelOption = z.infer<typeof speechModelSchema>;

export const speechModelListResponseSchema = z.object({ models: z.array(speechModelSchema) });

export const SPEECH_VOICE_ROLES = ["narrator", "host", "guest"] as const;
export type SpeechVoiceRole = (typeof SPEECH_VOICE_ROLES)[number];

export interface SpeechVoice {
  id: string;
  label: string;
}

export interface SpeechProviderVoices {
  label: string;
  voices: readonly SpeechVoice[];
  roles: Readonly<Record<SpeechVoiceRole, string>>;
}

export const SPEECH_PROVIDER_VOICES: Readonly<Record<SpeechProvider, SpeechProviderVoices>> = {
  elevenlabs: {
    label: "ElevenLabs",
    voices: [
      { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel - Steady broadcaster, British" },
      { id: "JBFqnCBsd6RMkjVDRZzb", label: "George - Warm storyteller, British" },
      { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice - Clear educator, British" },
      { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily - Velvety actress, British" },
      { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah - Mature and reassuring, American" },
      { id: "nPczCjzI2devNBz1zQrb", label: "Brian - Deep and comforting, American" },
      { id: "SAz9YHcvj6GT2YYXdXww", label: "River - Relaxed and neutral, American" },
    ],
    roles: {
      narrator: "onwK4e9ZLuTAKqWW03F9",
      host: "Xb7hH8MSUJpSbSDYk0k2",
      guest: "JBFqnCBsd6RMkjVDRZzb",
    },
  },
  cartesia: {
    label: "Cartesia",
    voices: [
      { id: "b24f41fd-00a3-4cd8-992a-a0c9f13f3ef1", label: "Clive - Measured expert" },
      { id: "a33f7a4c-100f-41cf-a1fd-5822e8fc253f", label: "Lauren - Lively narrator" },
      { id: "ef191366-f52f-447a-a398-ed8c0f2943a1", label: "Archie - Approachable mate" },
      { id: "273f9ef7-9fc2-4def-88bb-ab108c6249ca", label: "Julia - Gentle guide" },
      { id: "3a01612e-07da-4a85-bba8-ce10481df477", label: "Gareth - Conversational specialist" },
    ],
    roles: {
      narrator: "b24f41fd-00a3-4cd8-992a-a0c9f13f3ef1",
      host: "a33f7a4c-100f-41cf-a1fd-5822e8fc253f",
      guest: "b24f41fd-00a3-4cd8-992a-a0c9f13f3ef1",
    },
  },
  mistral: {
    label: "Mistral",
    voices: [
      { id: "voice_1787", label: "Mary - English, UK" },
      { id: "voice_1786", label: "Sky - English, UK" },
      { id: "voice_1788", label: "David - English, UK" },
      { id: "voice_590", label: "Harriet - English, UK" },
      { id: "voice_591", label: "Fred - English, UK" },
      { id: "voice_3149", label: "Hugo - English, UK" },
      { id: "voice_3147", label: "Howard - English, UK" },
      { id: "voice_478", label: "Sheila - English, US" },
      { id: "voice_447", label: "Margaret - English, US" },
      { id: "voice_485", label: "Rob - English, US" },
      { id: "voice_3150", label: "James - English, US" },
      { id: "voice_592", label: "Marie - French" },
      { id: "voice_3137", label: "Manon - French" },
      { id: "voice_589", label: "Lea - French" },
      { id: "voice_3141", label: "Camille - French" },
      { id: "voice_483", label: "Elena - Spanish" },
      { id: "voice_481", label: "Heidi - German" },
      { id: "voice_482", label: "Lorenzo - Italian" },
      { id: "voice_480", label: "Gabriela - Portuguese" },
      { id: "voice_479", label: "Maryam - Arabic" },
      { id: "voice_3143", label: "Jordi - Catalan" },
      { id: "voice_3139", label: "Ananya - Hindi" },
      { id: "voice_3153", label: "Himanshu - Hindi" },
      { id: "voice_3146", label: "Olivia - Hungarian" },
      { id: "voice_3133", label: "Haruto - Japanese" },
      { id: "voice_3136", label: "Sung - Korean" },
      { id: "voice_3135", label: "Jin - Korean" },
      { id: "voice_3145", label: "Lotte - Dutch" },
      { id: "voice_3134", label: "Lars - Norwegian" },
      { id: "voice_3154", label: "Leon - Polish" },
      { id: "voice_3155", label: "Irina - Romanian" },
      { id: "voice_3132", label: "Tatiana - Russian" },
      { id: "voice_3138", label: "Oran - Turkish" },
      { id: "voice_3140", label: "Taras - Ukrainian" },
      { id: "voice_3144", label: "Huong - Vietnamese" },
      { id: "voice_3142", label: "Mei - Chinese" },
    ],
    roles: { narrator: "voice_1788", host: "voice_1787", guest: "voice_1788" },
  },
  polly: {
    label: "Amazon Polly",
    voices: [
      { id: "Ruth", label: "Ruth - American" },
      { id: "Matthew", label: "Matthew - American" },
      { id: "Amy", label: "Amy - British" },
      { id: "Danielle", label: "Danielle - American" },
      { id: "Stephen", label: "Stephen - American" },
    ],
    roles: { narrator: "Matthew", host: "Ruth", guest: "Matthew" },
  },
  "workers-ai": {
    label: "Workers AI",
    voices: [
      { id: "orion", label: "Orion" },
      { id: "asteria", label: "Asteria" },
      { id: "arcas", label: "Arcas" },
      { id: "luna", label: "Luna" },
      { id: "athena", label: "Athena" },
      { id: "angus", label: "Angus" },
      { id: "helios", label: "Helios" },
    ],
    roles: { narrator: "orion", host: "asteria", guest: "arcas" },
  },
};
