import {
  verbatimSegmentFormSchema,
  verbatimStreamEventSchema,
} from "@ngriffin_uk/polychat-schemas";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { streamVerbatimSegment } from "~/modules/experiences/application/verbatim/stream-segment";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { requireExperience } from "./access";

export function defineVerbatim(app: HonoLike): void {
  defineResource(
    app,
    { path: "/verbatim/segments", idParam: "segment_id", tags: ["experiences"] },
    (segments) => {
      segments.create({
        auth: true,
        summary: "Transcribe and verify a live audio segment",
        description:
          "Streams a draft transcript of a short WAV segment as soon as it is transcribed, then the verified segment once Clef Omni has checked every word against the audio.",
        middleware: [requireExperience("featured-verbatim")],
        querySchema: projectScopeQuerySchema,
        formSchema: verbatimSegmentFormSchema,
        responses: {
          200: {
            description: "Server-sent draft and segment events",
            schema: verbatimStreamEventSchema,
          },
        },
        handler: async ({ raw, serviceContext, user }) => {
          const { audio, context } = verbatimSegmentFormSchema.parse(await raw.req.parseBody());

          return streamVerbatimSegment({ env: serviceContext.env, user, audio, context });
        },
      });
    },
  );
}
