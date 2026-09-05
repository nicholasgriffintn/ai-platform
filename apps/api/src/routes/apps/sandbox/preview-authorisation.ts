import { sandboxPreviewAuthorisationRequestSchema } from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import { authoriseSandboxPreview } from "~/services/apps/sandbox/previews";
import type { IEnv } from "~/types";

export function registerSandboxPreviewAuthorisationRoute(app: Hono<{ Bindings: IEnv }>): void {
  addRoute(app, "post", "/apps/sandbox/previews/authorise", {
    tags: ["internal"],
    auth: "service",
    serviceScope: "sandbox-preview:authorise",
    bodySchema: sandboxPreviewAuthorisationRequestSchema,
    handler: async ({ body, raw, serviceContext }) => {
      const response = await authoriseSandboxPreview({
        env: serviceContext.env,
        request: body,
      });

      raw.header("Cache-Control", "no-store");

      return response;
    },
  });
}
