import {
  mediaFingerprintSchema,
  mediaProvenanceEntrySchema,
  mediaProvenanceKeysSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { findMediaFingerprint, getProvenanceKeys } from "~/modules/generate/application/provenance";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();

defineResource(app, { idParam: "fingerprint", tags: ["provenance"] }, (provenance) => {
  provenance
    .view("keys", {
      auth: false,
      summary: "List provenance signing keys",
      description: "Public keys that verify the signature embedded in generated media.",
      responses: { 200: { description: "Signing keys", schema: mediaProvenanceKeysSchema } },
      handler: async ({ serviceContext }) => ({
        keys: await getProvenanceKeys(serviceContext.env),
      }),
    })
    .read({
      auth: false,
      summary: "Look up a generated file",
      description:
        "Confirms whether a file was generated here, from the SHA-256 of the file as downloaded.",
      paramSchema: z.object({ fingerprint: mediaFingerprintSchema }),
      responses: { 200: { description: "Provenance entry", schema: mediaProvenanceEntrySchema } },
      handler: async ({ params, serviceContext }) => {
        const entry = await findMediaFingerprint(
          serviceContext.env.PRIVATE_ASSETS_BUCKET,
          params.fingerprint,
        );

        if (!entry) {
          throw new AssistantError("No record of this file", ErrorType.NOT_FOUND, 404);
        }

        return entry;
      },
    });
});

export default app;
