import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const RESPONSE_STYLE_TONES = [
  "default",
  "professional",
  "friendly",
  "candid",
  "quirky",
  "efficient",
  "nerdy",
  "cynical",
] as const;

export const RESPONSE_STYLE_LEVELS = ["default", "more", "less"] as const;

export const responseStyleToneSchema = z.enum(RESPONSE_STYLE_TONES);
export const responseStyleLevelSchema = z.enum(RESPONSE_STYLE_LEVELS);

export type ResponseStyleTone = z.infer<typeof responseStyleToneSchema>;
export type ResponseStyleLevel = z.infer<typeof responseStyleLevelSchema>;

export const responseStyleSchema = z.object({
  tone: responseStyleToneSchema.default("default"),
  warmth: responseStyleLevelSchema.default("default"),
  enthusiasm: responseStyleLevelSchema.default("default"),
  emoji: responseStyleLevelSchema.default("default"),
  formatting: responseStyleLevelSchema.default("default"),
});

export type ResponseStyleSettings = z.infer<typeof responseStyleSchema>;

export const DEFAULT_RESPONSE_STYLE: ResponseStyleSettings = responseStyleSchema.parse({});

export function parseResponseStyle(value: unknown): ResponseStyleSettings {
  const candidate: unknown = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = responseStyleSchema.safeParse(candidate ?? {});

  return parsed.success ? parsed.data : DEFAULT_RESPONSE_STYLE;
}
