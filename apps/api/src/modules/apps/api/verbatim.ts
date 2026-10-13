import {
  errorResponseSchema,
  verbatimSegmentFormSchema,
  verbatimStreamEventSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { streamVerbatimSegment } from "~/modules/apps/application/verbatim/stream-segment";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

const app = new Hono();

addRoute(app, "post", "/segments", {
  tags: ["apps"],
  summary: "Transcribe and verify a live audio segment",
  description:
    "Streams a draft transcript of a short WAV segment as soon as it is transcribed, then the verified segment once Clef Omni has checked every word against the audio, judged fluency and dropped words the audio does not support.",
  auth: true,
  formSchema: verbatimSegmentFormSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: {
      description: "Server-sent draft, segment and error events",
      schema: verbatimStreamEventSchema,
    },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ query, raw, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      "featured-verbatim",
    );
    const { audio, context } = verbatimSegmentFormSchema.parse(raw.req.valid("form" as never));

    return streamVerbatimSegment({ env: serviceContext.env, user, audio, context });
  },
});

export default app;
