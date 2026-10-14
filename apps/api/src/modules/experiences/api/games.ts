import {
  errorResponseSchema,
  twentyQuestionsAnswerSchema,
  twentyQuestionsAskRequestSchema,
  twentyQuestionsGameSchema,
  twentyQuestionsRevealRequestSchema,
  twentyQuestionsRevealSchema,
  twentyQuestionsStartRequestSchema,
  verbatimSegmentFormSchema,
  verbatimStreamEventSchema,
} from "@ngriffin_uk/polychat-schemas";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import {
  askTwentyQuestions,
  revealTwentyQuestions,
  startTwentyQuestions,
} from "~/modules/experiences/application/twenty-questions/game";
import { streamVerbatimSegment } from "~/modules/experiences/application/verbatim/stream-segment";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { requireExperience } from "./access";

export function defineTwentyQuestions(app: HonoLike): void {
  const access = [requireExperience("featured-twenty-questions")];

  defineResource(
    app,
    { path: "/twenty_questions", idParam: "game_id", tags: ["experiences"] },
    (games) => {
      games
        .create({
          auth: true,
          summary: "Start a game of Twenty Questions",
          description:
            "Picks a secret from the category and returns it sealed inside an opaque game token.",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: twentyQuestionsStartRequestSchema,
          responses: { 200: { description: "A new game", schema: twentyQuestionsGameSchema } },
          handler: ({ body, serviceContext }) =>
            startTwentyQuestions(serviceContext.env, body.category),
        })
        .collectionAction("ask", {
          auth: true,
          summary: "Ask a yes or no question",
          description:
            "Judges a question or guess against the sealed secret and returns a calibrated yes probability with a warmth reading.",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: twentyQuestionsAskRequestSchema,
          responses: { 200: { description: "The answer", schema: twentyQuestionsAnswerSchema } },
          handler: ({ body, serviceContext, user }) =>
            askTwentyQuestions(serviceContext.env, user, body.token, body.question),
        })
        .collectionAction("reveal", {
          auth: true,
          summary: "Reveal the secret",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: twentyQuestionsRevealRequestSchema,
          responses: {
            200: { description: "The secret", schema: twentyQuestionsRevealSchema },
            400: { description: "Bad request", schema: errorResponseSchema },
          },
          handler: ({ body, serviceContext }) =>
            revealTwentyQuestions(serviceContext.env, body.token),
        });
    },
  );
}

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
