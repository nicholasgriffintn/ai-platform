import {
  errorResponseSchema,
  polisDecisionRequestSchema,
  polisDecisionResponseSchema,
  polisDraftRequestSchema,
  polisLawDraftSchema,
  polisRecordingSchema,
  polisScenarioDraftSchema,
  polisShareParamsSchema,
  polisShareSchema,
} from "@ngriffin_uk/polychat-schemas";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { decidePolisBuckets } from "~/modules/experiences/application/polis/decisions";
import { draftPolisLaw, draftPolisScenario } from "~/modules/experiences/application/polis/drafts";
import {
  readSharedPolisTown,
  sharePolisTown,
  stopSharingPolisTown,
} from "~/modules/experiences/application/polis/shares";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { requireExperience } from "./access";

export function definePolis(app: HonoLike): void {
  const access = [requireExperience("featured-polis")];

  defineResource(app, { path: "/polis", idParam: "town_id", tags: ["experiences"] }, (polis) => {
    polis
      .collectionAction("decisions", {
        auth: true,
        summary: "Judge how kinds of residents would act",
        description:
          "Asks a decision model how inclined each kind of resident is to take each life action, and optionally whether they would vote for a proposal.",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: polisDecisionRequestSchema,
        responses: {
          200: { description: "Answers per kind of resident", schema: polisDecisionResponseSchema },
          400: { description: "Bad request", schema: errorResponseSchema },
        },
        handler: ({ body, serviceContext, user }) =>
          decidePolisBuckets(serviceContext.env, user, body),
      })
      .collectionAction("laws", {
        auth: true,
        summary: "Turn a plain English proposal into a town law",
        description:
          "Maps the proposal onto the parameters and rules the simulation can enforce, or explains why it cannot.",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: polisDraftRequestSchema,
        responses: {
          200: { description: "The drafted law", schema: polisLawDraftSchema },
          400: { description: "Bad request", schema: errorResponseSchema },
        },
        handler: ({ body, serviceContext, user }) => draftPolisLaw(serviceContext.env, user, body),
      })
      .collectionAction("scenarios", {
        auth: true,
        summary: "Turn a plain English event into a town scenario",
        description: "Maps the request onto a scenario the simulation supports.",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: polisDraftRequestSchema,
        responses: {
          200: { description: "The drafted scenario", schema: polisScenarioDraftSchema },
          400: { description: "Bad request", schema: errorResponseSchema },
        },
        handler: ({ body, serviceContext, user }) =>
          draftPolisScenario(serviceContext.env, user, body),
      })
      .collectionAction("shares", {
        auth: true,
        summary: "Share a town publicly",
        description:
          "Stores the town's recording behind an unguessable link that anyone can open to watch it back.",
        middleware: access,
        querySchema: projectScopeQuerySchema,
        bodySchema: polisRecordingSchema,
        responses: {
          200: { description: "The share link token", schema: polisShareSchema },
          400: { description: "Bad request", schema: errorResponseSchema },
          413: { description: "The recording is too large", schema: errorResponseSchema },
        },
        handler: ({ body, serviceContext, user }) => sharePolisTown(serviceContext.env, user, body),
      })
      .shared({
        auth: false,
        summary: "Watch a shared town",
        description: "Returns a publicly shared town recording.",
        paramSchema: polisShareParamsSchema,
        responses: {
          200: { description: "The recording", schema: polisRecordingSchema },
          404: { description: "Not shared", schema: errorResponseSchema },
        },
        handler: ({ params, serviceContext }) =>
          readSharedPolisTown(serviceContext.env, params.token),
      });

    polis.collection("shares", "token").delete({
      auth: true,
      summary: "Stop sharing a town",
      paramSchema: polisShareParamsSchema,
      responses: {
        200: { description: "The withdrawn share", schema: polisShareSchema },
        404: { description: "Not shared", schema: errorResponseSchema },
      },
      handler: ({ params, serviceContext, user }) =>
        stopSharingPolisTown(serviceContext.env, user, params.token),
    });
  });
}

const PUBLIC_SHARE_PATH = /\/experiences\/polis\/shared\/[a-f0-9]{32}$/;

export function isPublicPolisRead(method: string, path: string): boolean {
  return method === "GET" && PUBLIC_SHARE_PATH.test(path);
}
