import z from "zod/v4";

import { siteDataIdentifierSchema, siteIntegrationScopeSchema } from "./site-data.js";
import { siteProjectSchema, siteReferenceUrlSchema } from "./sites.js";

export const siteBrowserViewportSchema = z.enum(["desktop", "mobile"]);
export const siteBrowserDiagnosticSchema = z
  .object({
    kind: z.enum(["console", "page_error", "request_failure", "assertion"]),
    message: z.string().max(2000),
  })
  .strict();
export const siteBrowserEvidenceSchema = z
  .object({
    id: z.string().min(1),
    siteId: z.string().min(1),
    revision: z.number().int().positive(),
    status: z.enum(["passed", "failed", "unavailable"]),
    checkedAt: z.string(),
    checks: z
      .array(
        z
          .object({
            pageId: siteDataIdentifierSchema,
            viewport: siteBrowserViewportSchema,
            status: z.enum(["passed", "failed", "unavailable"]),
            diagnostics: z.array(siteBrowserDiagnosticSchema).max(100),
          })
          .strict(),
      )
      .max(20),
    repairedFromRevision: z.number().int().positive().optional(),
  })
  .strict();
export const siteBrowserVerificationRequestSchema = siteIntegrationScopeSchema
  .extend({
    pageId: siteDataIdentifierSchema.optional(),
    repair: z.boolean().default(false),
  })
  .strict();

export const siteBrowserCaptureRequestSchema = z
  .object({
    resourceId: z.string().regex(/^site-probe-[a-zA-Z0-9-]{1,100}$/),
    document: z.string().min(1).max(1_000_000),
    frameId: z.string().regex(/^site-check-[a-zA-Z0-9-]{1,100}$/),
    project: siteProjectSchema,
    pageId: siteDataIdentifierSchema,
    data: z.record(siteDataIdentifierSchema, z.unknown()),
    viewport: siteBrowserViewportSchema,
    elementKeys: z.array(siteDataIdentifierSchema).max(100),
    allowedOrigins: z.array(z.url()).max(8),
  })
  .strict();
export const siteBrowserCaptureResultSchema = z
  .object({
    status: z.enum(["passed", "failed", "unavailable"]),
    diagnostics: z.array(siteBrowserDiagnosticSchema).max(100),
  })
  .strict();

const siteHexColourSchema = z.string().regex(/^#[0-9a-f]{6}$/);

export const siteReferenceCaptureRequestSchema = z
  .object({
    resourceId: z.string().regex(/^site-reference-[a-zA-Z0-9-]{1,100}$/),
    url: siteReferenceUrlSchema,
  })
  .strict();
export const siteReferenceCaptureResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("captured"),
      background: siteHexColourSchema.nullable(),
      foreground: siteHexColourSchema.nullable(),
      accents: z
        .array(z.object({ colour: siteHexColourSchema, weight: z.number().min(0) }).strict())
        .max(40),
      headingFamily: z.string().max(400).nullable(),
      bodyFamily: z.string().max(400).nullable(),
    })
    .strict(),
  z.object({ status: z.literal("unavailable") }).strict(),
]);

export type SiteBrowserEvidence = z.infer<typeof siteBrowserEvidenceSchema>;
export type SiteBrowserVerificationRequest = z.infer<typeof siteBrowserVerificationRequestSchema>;
export type SiteBrowserCaptureRequest = z.infer<typeof siteBrowserCaptureRequestSchema>;
export type SiteBrowserCaptureResult = z.infer<typeof siteBrowserCaptureResultSchema>;
export type SiteReferenceCaptureRequest = z.infer<typeof siteReferenceCaptureRequestSchema>;
export type SiteReferenceCaptureResult = z.infer<typeof siteReferenceCaptureResultSchema>;
