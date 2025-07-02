import { z } from "zod";
import "zod-openapi/extend";

export const githubLoginSchema = z.object({});

export const githubCallbackSchema = z.object({
  code: z.string().openapi({ example: "a1b2c3d4" }),
});

export const userSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  email: z.string().email(),
  github_username: z.string().nullable(),
  company: z.string().nullable(),
  site: z.string().nullable(),
  location: z.string().nullable(),
  bio: z.string().nullable(),
  twitter_username: z.string().nullable(),
  role: z.enum(["user", "admin", "moderator"]).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  setup_at: z.string().nullable(),
  terms_accepted_at: z.string().nullable(),
});

export const sessionSchema = z.object({
  id: z.string(),
  user_id: z.number(),
  expires_at: z.string(),
});

export const jwtTokenResponseSchema = z.object({
  token: z
    .string()
    .openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
  expires_in: z.number().openapi({ example: 604800 }),
  token_type: z.literal("Bearer").openapi({ example: "Bearer" }),
});

export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type JwtTokenResponse = z.infer<typeof jwtTokenResponseSchema>;
