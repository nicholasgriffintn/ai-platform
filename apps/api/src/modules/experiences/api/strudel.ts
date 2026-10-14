import {
  listPageOf,
  strudelGenerateResponseSchema,
  strudelGenerateSchema,
  strudelPatternDetailResponseSchema,
  strudelSavePatternSchema,
  strudelUpdatePatternSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { deletePattern } from "~/modules/experiences/application/strudel/delete";
import { submitStrudelFeedback } from "~/modules/experiences/application/strudel/feedback";
import { generateStrudelCode } from "~/modules/experiences/application/strudel/generate";
import { getPatternDetails } from "~/modules/experiences/application/strudel/get-details";
import { listPatterns } from "~/modules/experiences/application/strudel/list";
import { savePattern } from "~/modules/experiences/application/strudel/save";
import { updatePattern } from "~/modules/experiences/application/strudel/update";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { requireExperience } from "./access";

const patternParamsSchema = z.object({ pattern_id: z.string().min(1) });
const feedbackSchema = z.object({
  generationId: z.string(),
  score: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
});
const access = [requireExperience("featured-strudel")];

export function defineStrudel(app: HonoLike): void {
  defineResource(
    app,
    { path: "/strudel", idParam: "pattern_id", tags: ["experiences"] },
    (patterns) => {
      patterns
        .list({
          auth: true,
          summary: "List Strudel patterns",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          handler: async ({ query, serviceContext, user }) =>
            listPageOf(
              await listPatterns({
                context: serviceContext,
                userId: user.id,
                projectId: query.project_id,
              }),
              (pattern) => pattern.id,
            ),
        })
        .create({
          auth: true,
          summary: "Save a Strudel pattern",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: strudelSavePatternSchema,
          responses: {
            200: { description: "The pattern", schema: strudelPatternDetailResponseSchema },
          },
          handler: async ({ body, query, serviceContext, user }) => ({
            pattern: await savePattern({
              context: serviceContext,
              request: body,
              user,
              projectId: query.project_id,
            }),
          }),
        })
        .read({
          auth: true,
          summary: "Get a Strudel pattern",
          middleware: access,
          paramSchema: patternParamsSchema,
          querySchema: projectScopeQuerySchema,
          responses: {
            200: { description: "The pattern", schema: strudelPatternDetailResponseSchema },
          },
          handler: async ({ params, query, serviceContext, user }) => ({
            pattern: await getPatternDetails({
              context: serviceContext,
              userId: user.id,
              patternId: params.pattern_id,
              projectId: query.project_id,
            }),
          }),
        })
        .update({
          auth: true,
          summary: "Update a Strudel pattern",
          middleware: access,
          paramSchema: patternParamsSchema,
          querySchema: projectScopeQuerySchema,
          bodySchema: strudelUpdatePatternSchema,
          responses: {
            200: { description: "The pattern", schema: strudelPatternDetailResponseSchema },
          },
          handler: async ({ body, params, query, serviceContext, user }) => ({
            pattern: await updatePattern({
              context: serviceContext,
              request: body,
              user,
              patternId: params.pattern_id,
              projectId: query.project_id,
            }),
          }),
        })
        .delete({
          auth: true,
          summary: "Delete a Strudel pattern",
          middleware: access,
          paramSchema: patternParamsSchema,
          querySchema: projectScopeQuerySchema,
          handler: async ({ params, query, serviceContext, user }) => {
            await deletePattern({
              context: serviceContext,
              userId: user.id,
              patternId: params.pattern_id,
              projectId: query.project_id,
            });

            return { deleted: true };
          },
        })
        .collectionAction("generate", {
          auth: true,
          summary: "Generate Strudel code from a prompt",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: strudelGenerateSchema,
          responses: {
            200: { description: "Generated code", schema: strudelGenerateResponseSchema },
          },
          handler: ({ body, serviceContext, user }) =>
            generateStrudelCode({ context: serviceContext, request: body, user }),
        })
        .collectionAction("feedback", {
          auth: true,
          summary: "Rate a Strudel generation",
          bodySchema: feedbackSchema,
          handler: ({ body, serviceContext, user }) =>
            submitStrudelFeedback({
              context: serviceContext,
              userId: user.id,
              generationId: body.generationId,
              score: body.score,
              feedback: body.feedback,
            }),
        });
    },
  );
}
