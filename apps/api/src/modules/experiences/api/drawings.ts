import { drawingSchema, guessDrawingSchema, listPageOf } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { generateImageFromDrawing } from "~/modules/experiences/application/drawing/create";
import { getDrawingDetails } from "~/modules/experiences/application/drawing/get-details";
import { guessDrawingFromImage } from "~/modules/experiences/application/drawing/guess";
import { listDrawings } from "~/modules/experiences/application/drawing/list";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { proExperience } from "./access";

const drawingParamsSchema = z.object({ drawing_id: z.string().min(1) });
const access = proExperience("featured-image-studio");

function requireSucceeded<TResponse extends { status?: string }>(response: TResponse): TResponse {
  if (response.status === "error") {
    throw new AssistantError("Something went wrong, we are working on it", ErrorType.UNKNOWN_ERROR);
  }

  return response;
}

export function defineDrawings(app: HonoLike): void {
  defineResource(
    app,
    { path: "/drawings", idParam: "drawing_id", tags: ["experiences"] },
    (drawings) => {
      drawings
        .list({
          auth: true,
          summary: "List drawings",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          handler: async ({ query, serviceContext, user }) =>
            listPageOf(
              await listDrawings({
                context: serviceContext,
                projectId: query.project_id,
                userId: user.id,
              }),
              (drawing) => drawing.id,
            ),
        })
        .create({
          auth: true,
          summary: "Turn a drawing into an image",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          formSchema: drawingSchema,
          handler: async ({ raw, query, serviceContext, user }) => {
            const body = drawingSchema.parse(await raw.req.parseBody());

            return requireSucceeded(
              await generateImageFromDrawing({
                context: serviceContext,
                projectId: query.project_id,
                env: serviceContext.env,
                request: body,
                user,
                existingDrawingId: body.drawingId,
              }),
            );
          },
        })
        .read({
          auth: true,
          summary: "Get a drawing",
          middleware: access,
          paramSchema: drawingParamsSchema,
          querySchema: projectScopeQuerySchema,
          handler: async ({ params, query, serviceContext, user }) => ({
            drawing: await getDrawingDetails({
              context: serviceContext,
              projectId: query.project_id,
              userId: user.id,
              drawingId: params.drawing_id,
            }),
          }),
        })
        .collectionAction("guess", {
          auth: true,
          summary: "Guess what a drawing shows",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          formSchema: guessDrawingSchema,
          handler: async ({ raw, query, serviceContext, user }) =>
            requireSucceeded(
              await guessDrawingFromImage({
                context: serviceContext,
                projectId: query.project_id,
                env: serviceContext.env,
                request: guessDrawingSchema.parse(await raw.req.parseBody()),
                user,
              }),
            ),
        });
    },
  );
}
