import {
  siteBrowserVerificationRequestSchema,
  siteConnectorSnapshotRequestSchema,
  siteDataActionSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

const scope = { siteId: z.string().min(1), expectedRevision: z.number().int().positive() };

export const manageSiteInputSchema = z.discriminatedUnion("operation", [
  z.object({ ...scope, operation: z.literal("read_data") }).strict(),
  z.object({ ...scope, operation: z.literal("enable_storage") }).strict(),
  z.object({ ...scope, operation: z.literal("disable_storage") }).strict(),
  z
    .object({ ...scope, operation: z.literal("data_action"), action: siteDataActionSchema })
    .strict(),
  siteConnectorSnapshotRequestSchema
    .omit({ projectId: true })
    .extend({
      siteId: scope.siteId,
      operationId: z.string().min(1),
      operation: z.literal("connector_snapshot"),
    })
    .strict(),
  z
    .object({ ...scope, operation: z.literal("refresh_source"), bindingId: z.string().min(1) })
    .strict(),
  siteBrowserVerificationRequestSchema
    .omit({ projectId: true })
    .extend({ siteId: scope.siteId, operation: z.literal("verify") })
    .strict(),
]);

export const manage_site: FunctionToolDescriptor = {
  name: "manage_site",
  type: "normal",
  permissions: ["read", "write", "network"],
  description:
    "Extend an existing Sites app with persistent records, scoped data or browser verification. Use the siteId and current revision returned by build_site. Enable storage only when the user requests saved records. For connector_snapshot, discover the exact read-only operation and its parameters with use_recipe_connector first; pass its ID as operationId, select the user's account, and project result rows into simple fields. Never place credentials or connector results in the site specification. Verify runs desktop and mobile checks; repair=true permits one refinement and recheck.",
  intentEvidence: (input) => ({
    operation: input.operation,
    siteId: input.siteId,
    expectedRevision: input.expectedRevision,
  }),
  inputSchema: manageSiteInputSchema,
};
