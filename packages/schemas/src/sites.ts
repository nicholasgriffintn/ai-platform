import z from "zod/v4";

import { decisionAnswerSchema } from "./decisions.js";
import { modelTierSchema } from "./model-lineup.js";

export const SITES_CAPABILITY_ID = "featured-sites";
export const SITE_OUTPUT_KIND = "site";
export const SITE_PROMPT_MAX_LENGTH = 4000;
export const SITE_ELEMENT_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const SITE_PAGE_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

export const SITE_KINDS = [
  "landing",
  "marketing",
  "portfolio",
  "dashboard",
  "app",
  "form",
  "docs",
  "component",
] as const;
export const siteKindSchema = z.enum(SITE_KINDS);
export type SiteKind = z.infer<typeof siteKindSchema>;

export const SITE_SCOPES = ["component", "page", "site"] as const;
export const siteScopeSchema = z.enum(SITE_SCOPES);
export type SiteScope = z.infer<typeof siteScopeSchema>;

export const SITE_PALETTES = [
  "neutral",
  "slate",
  "ocean",
  "forest",
  "sunset",
  "berry",
  "sand",
  "midnight",
] as const;
export const sitePaletteSchema = z.enum(SITE_PALETTES);
export type SitePalette = z.infer<typeof sitePaletteSchema>;

export const SITE_FONTS = ["sans", "serif", "mono", "display"] as const;
export const siteFontSchema = z.enum(SITE_FONTS);
export type SiteFont = z.infer<typeof siteFontSchema>;

export const SITE_RADII = ["none", "sm", "md", "lg", "full"] as const;
export const siteRadiusSchema = z.enum(SITE_RADII);
export type SiteRadius = z.infer<typeof siteRadiusSchema>;

export const SITE_MODES = ["light", "dark"] as const;
export const siteModeSchema = z.enum(SITE_MODES);
export type SiteMode = z.infer<typeof siteModeSchema>;

export const SITE_TONES = ["plain", "friendly", "bold", "editorial", "technical"] as const;
export const siteToneSchema = z.enum(SITE_TONES);
export type SiteTone = z.infer<typeof siteToneSchema>;

export const siteThemeSchema = z
  .object({
    palette: sitePaletteSchema,
    font: siteFontSchema,
    radius: siteRadiusSchema,
    mode: siteModeSchema,
  })
  .strict();
export type SiteTheme = z.infer<typeof siteThemeSchema>;

export const DEFAULT_SITE_THEME: SiteTheme = {
  palette: "neutral",
  font: "sans",
  radius: "md",
  mode: "light",
};

export const siteElementSchema = z
  .object({
    type: z.string().min(1).max(64),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(z.string().regex(SITE_ELEMENT_KEY_PATTERN)).default([]),
  })
  .strict();
export type SiteElement = z.infer<typeof siteElementSchema>;

export const siteSpecSchema = z
  .object({
    root: z.string().regex(SITE_ELEMENT_KEY_PATTERN),
    elements: z.record(z.string().regex(SITE_ELEMENT_KEY_PATTERN), siteElementSchema),
    state: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SiteSpec = z.infer<typeof siteSpecSchema>;

export const sitePageSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(80)
      .regex(/^\/[a-z0-9\-/]*$/),
    title: z.string().min(1).max(80),
    root: z.string().regex(SITE_ELEMENT_KEY_PATTERN),
    elements: z.record(z.string().regex(SITE_ELEMENT_KEY_PATTERN), siteElementSchema),
    state: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SitePage = z.infer<typeof sitePageSchema>;

export const sitePlanSchema = z
  .object({
    kind: siteKindSchema,
    scope: siteScopeSchema,
    tier: modelTierSchema,
    tone: siteToneSchema,
    theme: siteThemeSchema,
    interactive: z.boolean(),
    confidence: z.number().min(0).max(1),
    answers: z.record(z.string(), decisionAnswerSchema).optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
  })
  .strict();
export type SitePlan = z.infer<typeof sitePlanSchema>;

export const siteProjectSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(400).optional(),
    theme: siteThemeSchema,
    pages: z.record(z.string().regex(SITE_PAGE_ID_PATTERN), sitePageSchema),
  })
  .strict();
export type SiteProject = z.infer<typeof siteProjectSchema>;

export const sitePatchOperationSchema = z.enum(["add", "replace", "remove"]);
export type SitePatchOperation = z.infer<typeof sitePatchOperationSchema>;

export const sitePatchSchema = z
  .object({
    op: sitePatchOperationSchema,
    path: z.string().min(1).max(512),
    value: z.unknown().optional(),
  })
  .strict();
export type SitePatch = z.infer<typeof sitePatchSchema>;

export const siteIssueSchema = z
  .object({
    severity: z.enum(["error", "warning"]),
    pageId: z.string().optional(),
    elementKey: z.string().optional(),
    message: z.string(),
  })
  .strict();
export type SiteIssue = z.infer<typeof siteIssueSchema>;

export const siteTurnSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    prompt: z.string().max(SITE_PROMPT_MAX_LENGTH),
    createdAt: z.string(),
    plan: sitePlanSchema.optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
  })
  .strict();
export type SiteTurn = z.infer<typeof siteTurnSchema>;

export const siteRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    brief: z.string().max(SITE_PROMPT_MAX_LENGTH),
    projectId: z.string().nullable(),
    revision: z.number().int().positive(),
    plan: sitePlanSchema,
    project: siteProjectSchema,
    issues: z.array(siteIssueSchema),
    turns: z.array(siteTurnSchema),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();
export type SiteRecord = z.infer<typeof siteRecordSchema>;

export const siteSummarySchema = siteRecordSchema
  .pick({
    id: true,
    title: true,
    brief: true,
    projectId: true,
    revision: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    kind: siteKindSchema,
    scope: siteScopeSchema,
    pageCount: z.number().int().nonnegative(),
    theme: siteThemeSchema,
  })
  .strict();
export type SiteSummary = z.infer<typeof siteSummarySchema>;

export const siteGenerateRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(SITE_PROMPT_MAX_LENGTH),
    projectId: z.string().min(1).optional(),
    siteId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    theme: siteThemeSchema.partial().optional(),
  })
  .strict();
export type SiteGenerateRequest = z.infer<typeof siteGenerateRequestSchema>;

export const siteStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan"), plan: sitePlanSchema }).strict(),
  z
    .object({
      type: z.literal("model"),
      provider: z.string(),
      model: z.string(),
    })
    .strict(),
  z.object({ type: z.literal("patch"), patch: sitePatchSchema }).strict(),
  z.object({ type: z.literal("saved"), site: siteRecordSchema }).strict(),
  z
    .object({
      type: z.literal("done"),
      issues: z.array(siteIssueSchema),
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative().optional(),
          outputTokens: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .strict(),
  z.object({ type: z.literal("error"), error: z.string() }).strict(),
]);
export type SiteStreamEvent = z.infer<typeof siteStreamEventSchema>;

export const siteFileSchema = z
  .object({
    path: z.string().min(1).max(256),
    content: z.string(),
  })
  .strict();
export type SiteFile = z.infer<typeof siteFileSchema>;

export const siteFilesResponseSchema = z
  .object({
    files: z.array(siteFileSchema),
  })
  .strict();
export type SiteFilesResponse = z.infer<typeof siteFilesResponseSchema>;

export const siteBuildRequestSchema = z
  .object({
    projectId: z.string().min(1),
    instructions: z.string().trim().max(2000).optional(),
  })
  .strict();
export type SiteBuildRequest = z.infer<typeof siteBuildRequestSchema>;

export const siteBuildResponseSchema = z
  .object({
    runId: z.string().min(1),
    repo: z.string().min(1),
  })
  .strict();
export type SiteBuildResponse = z.infer<typeof siteBuildResponseSchema>;

export const listSitesQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
export type ListSitesQuery = z.infer<typeof listSitesQuerySchema>;

export const siteListResponseSchema = z.object({ sites: z.array(siteSummarySchema) }).strict();
export type SiteListResponse = z.infer<typeof siteListResponseSchema>;

export const siteResponseSchema = z.object({ site: siteRecordSchema }).strict();
export type SiteResponse = z.infer<typeof siteResponseSchema>;

export function createEmptySiteProject(theme: SiteTheme = DEFAULT_SITE_THEME): SiteProject {
  return { title: "Untitled", theme, pages: {} };
}

export function listSitePages(project: SiteProject): Array<{ id: string; page: SitePage }> {
  return Object.entries(project.pages)
    .map(([id, page]) => ({ id, page }))
    .sort((a, b) => {
      if (a.page.path === "/") {
        return -1;
      }

      if (b.page.path === "/") {
        return 1;
      }

      return a.page.path.localeCompare(b.page.path);
    });
}
