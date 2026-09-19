import z from "zod/v4";

import { decisionAnswerSchema, decisionQuestionSchema } from "./decisions.js";
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
  "commerce",
  "booking",
  "event",
  "publication",
  "community",
  "education",
  "ai-tool",
  "game",
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

export const SITE_DESIGN_DIRECTIONS = [
  "minimal",
  "editorial",
  "utilitarian",
  "brutalist",
  "playful",
  "luxury",
  "organic",
  "retro",
  "futuristic",
  "maximalist",
] as const;
export const siteDesignDirectionSchema = z.enum(SITE_DESIGN_DIRECTIONS);
export type SiteDesignDirection = z.infer<typeof siteDesignDirectionSchema>;

export const SITE_DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const siteDensitySchema = z.enum(SITE_DENSITIES);
export type SiteDensity = z.infer<typeof siteDensitySchema>;

export const SITE_TEXTURES = ["clean", "grain", "grid", "gradient", "glow"] as const;
export const siteTextureSchema = z.enum(SITE_TEXTURES);
export type SiteTexture = z.infer<typeof siteTextureSchema>;

export const SITE_MOTION_LEVELS = ["none", "restrained", "expressive"] as const;
export const siteMotionLevelSchema = z.enum(SITE_MOTION_LEVELS);
export type SiteMotionLevel = z.infer<typeof siteMotionLevelSchema>;

export const SITE_CAPABILITIES = [
  "content",
  "navigation",
  "forms",
  "search",
  "filtering",
  "visualisation",
  "crud",
  "authentication",
  "commerce",
  "booking",
  "files",
  "ai",
  "realtime",
  "payments",
] as const;
export const siteCapabilitySchema = z.enum(SITE_CAPABILITIES);
export type SiteCapability = z.infer<typeof siteCapabilitySchema>;

export const SITE_EXPORT_TARGETS = ["react-router", "next", "tanstack-router"] as const;
export const siteExportTargetSchema = z.enum(SITE_EXPORT_TARGETS);
export type SiteExportTarget = z.infer<typeof siteExportTargetSchema>;

export const DEFAULT_SITE_EXPORT_TARGET: SiteExportTarget = "react-router";

export const siteThemeSchema = z
  .object({
    palette: sitePaletteSchema,
    font: siteFontSchema,
    radius: siteRadiusSchema,
    mode: siteModeSchema,
    direction: siteDesignDirectionSchema,
    density: siteDensitySchema,
    texture: siteTextureSchema,
    motion: siteMotionLevelSchema,
  })
  .strict();
export type SiteTheme = z.infer<typeof siteThemeSchema>;

export const DEFAULT_SITE_THEME: SiteTheme = {
  palette: "neutral",
  font: "sans",
  radius: "md",
  mode: "light",
  direction: "minimal",
  density: "comfortable",
  texture: "clean",
  motion: "restrained",
};

export const siteElementStyleSchema = z
  .object({
    width: z.enum(["narrow", "content", "wide", "full"]).optional(),
    spacing: z.enum(["none", "compact", "normal", "generous", "dramatic"]).optional(),
    palette: sitePaletteSchema.optional(),
    tone: z.enum(["inherit", "muted", "primary"]).optional(),
    surface: z
      .enum(["transparent", "canvas", "muted", "card", "primary", "inverted", "glass"])
      .optional(),
    align: z.enum(["start", "center", "end"]).optional(),
    border: z.enum(["none", "subtle", "strong"]).optional(),
    shadow: z.enum(["none", "sm", "md", "xl"]).optional(),
    radius: z.enum(["none", "sm", "md", "lg", "xl", "full"]).optional(),
    motion: z.enum(["none", "fade", "rise", "scale", "slide"]).optional(),
    bleed: z.boolean().optional(),
    sticky: z.boolean().optional(),
  })
  .strict();
export type SiteElementStyle = z.infer<typeof siteElementStyleSchema>;

export const SITE_STATE_PATH_PATTERN = /^\/[A-Za-z0-9_\-/]*$/;
export const siteStatePathSchema = z.string().regex(SITE_STATE_PATH_PATTERN);

export const SITE_ACTIONS = [
  "setState",
  "toggleState",
  "pushState",
  "removeState",
  "navigate",
] as const;
export const siteActionNameSchema = z.enum(SITE_ACTIONS);
export type SiteActionName = z.infer<typeof siteActionNameSchema>;

export const siteActionBindingSchema = z
  .object({
    action: siteActionNameSchema,
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SiteActionBinding = z.infer<typeof siteActionBindingSchema>;

export const SITE_EVENTS = ["press", "change", "submit"] as const;
export const siteEventNameSchema = z.enum(SITE_EVENTS);
export type SiteEventName = z.infer<typeof siteEventNameSchema>;

const comparison = {
  eq: z.unknown().optional(),
  neq: z.unknown().optional(),
  in: z.array(z.unknown()).optional(),
  truthy: z.boolean().optional(),
};

export type SiteVisibility =
  | ({ $state: string } & { eq?: unknown; neq?: unknown; in?: unknown[]; truthy?: boolean })
  | ({ $item: string } & { eq?: unknown; neq?: unknown; in?: unknown[]; truthy?: boolean })
  | { and: SiteVisibility[] }
  | { or: SiteVisibility[] }
  | { not: SiteVisibility };

export const siteVisibilitySchema: z.ZodType<SiteVisibility> = z.lazy(() =>
  z.union([
    z.object({ $state: siteStatePathSchema, ...comparison }).strict(),
    z.object({ $item: z.string().min(1), ...comparison }).strict(),
    z.object({ and: z.array(siteVisibilitySchema).min(1) }).strict(),
    z.object({ or: z.array(siteVisibilitySchema).min(1) }).strict(),
    z.object({ not: siteVisibilitySchema }).strict(),
  ]),
);

export const siteRepeatSchema = z
  .object({
    statePath: siteStatePathSchema,
    key: z.string().min(1).optional(),
  })
  .strict();
export type SiteRepeat = z.infer<typeof siteRepeatSchema>;

export const siteElementSchema = z
  .object({
    type: z.string().min(1).max(64),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(z.string().regex(SITE_ELEMENT_KEY_PATTERN)).default([]),
    visible: siteVisibilitySchema.optional(),
    repeat: siteRepeatSchema.optional(),
    on: z.partialRecord(siteEventNameSchema, siteActionBindingSchema).optional(),
    style: siteElementStyleSchema.optional(),
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
    capabilities: z.array(siteCapabilitySchema),
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
    capabilities: z.array(siteCapabilitySchema),
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

export const SITE_REFINE_INTENTS = ["tweak", "restructure", "page", "theme"] as const;
export const siteRefineIntentSchema = z.enum(SITE_REFINE_INTENTS);
export type SiteRefineIntent = z.infer<typeof siteRefineIntentSchema>;

export const siteQualitySchema = z
  .object({
    coverage: z.number().min(0).max(1),
    placeholders: z.number().min(0).max(1),
    coherent: z.number().min(0).max(1),
    readable: z.number().min(0).max(1).optional(),
    repairs: z.number().int().nonnegative(),
    needsRepair: z.boolean(),
    confidence: z.number().min(0).max(1),
    repairConfidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type SiteQuality = z.infer<typeof siteQualitySchema>;

export const SITE_DECISION_STAGES = ["plan", "refinement", "quality"] as const;
export const siteDecisionStageSchema = z.enum(SITE_DECISION_STAGES);
export type SiteDecisionStage = z.infer<typeof siteDecisionStageSchema>;

export const siteDecisionTraceQuestionSchema = z
  .object({
    id: z.string().min(1).max(128),
    question: decisionQuestionSchema,
    answer: decisionAnswerSchema.optional(),
  })
  .strict();
export type SiteDecisionTraceQuestion = z.infer<typeof siteDecisionTraceQuestionSchema>;

export const siteDecisionTraceEntrySchema = z
  .object({
    kind: z.literal("decision"),
    version: z.literal(1),
    id: z.string().min(1).max(160),
    stage: siteDecisionStageSchema,
    source: z.enum(["decision", "heuristic", "unavailable"]),
    summary: z.string().min(1).max(300),
    effects: z.array(z.string().min(1).max(240)).max(16),
    questions: z.array(siteDecisionTraceQuestionSchema).max(256),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    createdAt: z.string(),
  })
  .strict();
export type SiteDecisionTraceEntry = z.infer<typeof siteDecisionTraceEntrySchema>;

export const siteGenerationTraceEntrySchema = z
  .object({
    kind: z.literal("generation"),
    version: z.literal(1),
    id: z.string().min(1).max(160),
    stage: z.enum(["build", "repair"]),
    outcome: z.enum(["applied", "discarded"]),
    summary: z.string().min(1).max(300),
    provider: z.string().min(1),
    model: z.string().min(1),
    patchCount: z.number().int().nonnegative(),
    rejectedPatchCount: z.number().int().nonnegative(),
    skippedLineCount: z.number().int().nonnegative().optional(),
    durationMs: z.number().int().nonnegative(),
    createdAt: z.string(),
  })
  .strict();
export type SiteGenerationTraceEntry = z.infer<typeof siteGenerationTraceEntrySchema>;

export const siteTraceEntrySchema = z.discriminatedUnion("kind", [
  siteDecisionTraceEntrySchema,
  siteGenerationTraceEntrySchema,
]);
export type SiteTraceEntry = z.infer<typeof siteTraceEntrySchema>;

export const siteTurnSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant", "edit"]),
    prompt: z.string().max(SITE_PROMPT_MAX_LENGTH),
    createdAt: z.string(),
    plan: sitePlanSchema.optional(),
    intent: siteRefineIntentSchema.optional(),
    target: z
      .object({
        pageId: z.string().regex(SITE_PAGE_ID_PATTERN),
        elementKey: z.string().regex(SITE_ELEMENT_KEY_PATTERN),
      })
      .strict()
      .optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    trace: z.array(siteTraceEntrySchema).optional(),
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
    quality: siteQualitySchema.nullable(),
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

export const siteElementTargetSchema = z
  .object({
    pageId: z.string().regex(SITE_PAGE_ID_PATTERN),
    elementKey: z.string().regex(SITE_ELEMENT_KEY_PATTERN),
  })
  .strict();
export type SiteElementTarget = z.infer<typeof siteElementTargetSchema>;

export const siteGenerateRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(SITE_PROMPT_MAX_LENGTH),
    projectId: z.string().min(1).optional(),
    siteId: z.string().min(1).optional(),
    target: siteElementTargetSchema.optional(),
    model: z.string().min(1).optional(),
    theme: siteThemeSchema.partial().optional(),
  })
  .strict();
export type SiteGenerateRequest = z.infer<typeof siteGenerateRequestSchema>;

export const SITE_EDIT_MAX_PATCHES = 200;

export const siteEditRequestSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    patches: z.array(sitePatchSchema).min(1).max(SITE_EDIT_MAX_PATCHES),
    summary: z.string().trim().min(1).max(200),
  })
  .strict();
export type SiteEditRequest = z.infer<typeof siteEditRequestSchema>;

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
  z.object({ type: z.literal("trace"), entry: siteTraceEntrySchema }).strict(),
  z
    .object({
      type: z.literal("phase"),
      phase: z.enum(["planning", "selecting", "streaming", "reviewing", "repairing", "saving"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("intent"),
      intent: siteRefineIntentSchema,
      tier: modelTierSchema,
      target: siteElementTargetSchema.nullable(),
      confidence: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("saved"),
      stage: z.enum(["initial", "final"]),
      site: siteRecordSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("done"),
      issues: z.array(siteIssueSchema),
      quality: siteQualitySchema.nullable().optional(),
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
    target: siteExportTargetSchema,
    files: z.array(siteFileSchema),
  })
  .strict();
export type SiteFilesResponse = z.infer<typeof siteFilesResponseSchema>;

export const siteFilesQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    target: siteExportTargetSchema.default(DEFAULT_SITE_EXPORT_TARGET),
  })
  .strict();
export type SiteFilesQuery = z.infer<typeof siteFilesQuerySchema>;

export const siteBuildRequestSchema = z
  .object({
    projectId: z.string().min(1),
    instructions: z.string().trim().max(2000).optional(),
    target: siteExportTargetSchema.default(DEFAULT_SITE_EXPORT_TARGET),
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

export const sitePullRequestRequestSchema = z
  .object({
    projectId: z.string().min(1),
    directory: z
      .string()
      .trim()
      .max(120)
      .regex(/^(?!\.)[A-Za-z0-9._\-/]*$/, "Directory must be a relative path")
      .optional(),
    title: z.string().trim().min(1).max(120).optional(),
    target: siteExportTargetSchema.default(DEFAULT_SITE_EXPORT_TARGET),
  })
  .strict();
export type SitePullRequestRequest = z.infer<typeof sitePullRequestRequestSchema>;

export const sitePullRequestResponseSchema = z
  .object({
    repo: z.string().min(1),
    branch: z.string().min(1),
    number: z.number().int().positive(),
    url: z.url(),
    fileCount: z.number().int().nonnegative(),
  })
  .strict();
export type SitePullRequestResponse = z.infer<typeof sitePullRequestResponseSchema>;

export const siteImagesRequestSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    limit: z.number().int().positive().max(12).optional(),
  })
  .strict();
export type SiteImagesRequest = z.infer<typeof siteImagesRequestSchema>;

export const siteImagesResponseSchema = z
  .object({
    site: siteRecordSchema,
    generated: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .strict();
export type SiteImagesResponse = z.infer<typeof siteImagesResponseSchema>;

export const siteEvaluationRequestSchema = z
  .object({
    briefs: z.array(z.string().trim().min(1).max(SITE_PROMPT_MAX_LENGTH)).min(1).max(12),
    guidance: z.array(z.boolean()).min(1).max(2).optional(),
    subset: z.array(z.boolean()).min(1).max(2).optional(),
    tiers: z.array(modelTierSchema).min(1).max(4).optional(),
    model: z.string().min(1).optional(),
    concurrency: z.number().int().min(1).max(4).optional(),
  })
  .strict();
export type SiteEvaluationRequest = z.infer<typeof siteEvaluationRequestSchema>;

export const siteEvaluationRunSchema = z
  .object({
    variantId: z.string(),
    brief: z.string(),
    ok: z.boolean(),
    durationMs: z.number().nonnegative(),
    score: z.number().min(0).max(1),
    quality: siteQualitySchema.nullable(),
    issues: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
    model: z.string().nullable(),
    error: z.string().optional(),
  })
  .strict();
export type SiteEvaluationRun = z.infer<typeof siteEvaluationRunSchema>;

export const siteEvaluationResponseSchema = z
  .object({
    key: z.string(),
    best: z.object({ variantId: z.string(), score: z.number() }).nullable(),
    variants: z.array(
      z
        .object({
          variantId: z.string(),
          ok: z.boolean(),
          score: z.number().nullable(),
          durationMs: z.number().nonnegative(),
          error: z.string().nullable(),
        })
        .strict(),
    ),
    runs: z.array(siteEvaluationRunSchema),
  })
  .strict();
export type SiteEvaluationResponse = z.infer<typeof siteEvaluationResponseSchema>;

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
  return { title: "Untitled", theme, capabilities: ["content", "navigation"], pages: {} };
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
