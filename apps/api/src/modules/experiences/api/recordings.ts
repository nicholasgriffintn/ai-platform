import { listPageOf, recordingDetailResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { handleRecordingDetail } from "~/modules/experiences/application/recordings/get-details";
import { handleRecordingList } from "~/modules/experiences/application/recordings/list";
import { handleRecordingUpload } from "~/modules/experiences/application/recordings/upload";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { proExperience } from "./access";

const recordingParamsSchema = z.object({ recording_id: z.string().min(1) });
const access = proExperience("featured-recording-processor");

export function defineRecordings(app: HonoLike): void {
  defineResource(
    app,
    { path: "/recordings", idParam: "recording_id", tags: ["experiences"] },
    (recordings) => {
      recordings
        .list({
          auth: true,
          summary: "List recordings",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          handler: async ({ query, serviceContext, user }) =>
            listPageOf(
              await handleRecordingList({
                context: serviceContext,
                user,
                projectId: query.project_id,
              }),
              (recording) => recording.id,
            ),
        })
        .create({
          auth: true,
          summary: "Upload a recording",
          description: "Accepts multipart form data with an audio file or audio URL.",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          handler: async ({ query, raw, serviceContext, user }) => {
            const formData = await raw.req.formData();
            const audio = formData.get("audio");
            const audioUrl = formData.get("audioUrl");
            const title = formData.get("title");
            const description = formData.get("description");

            if (!(audio instanceof File) && typeof audioUrl !== "string") {
              throw new AssistantError("Missing audio file or URL", ErrorType.PARAMS_ERROR);
            }

            const response = await handleRecordingUpload({
              context: serviceContext,
              request: {
                audio: audio instanceof File ? audio : null,
                audioUrl: typeof audioUrl === "string" ? audioUrl : null,
                title: typeof title === "string" ? title : "",
                description: typeof description === "string" ? description : undefined,
              },
              user,
              projectId: query.project_id,
            });

            if (response.status === "error") {
              throw new AssistantError(
                "Something went wrong, we are working on it",
                ErrorType.UNKNOWN_ERROR,
              );
            }

            return { response };
          },
        })
        .read({
          auth: true,
          summary: "Get a recording",
          middleware: access,
          paramSchema: recordingParamsSchema,
          querySchema: projectScopeQuerySchema,
          responses: {
            200: { description: "The recording", schema: recordingDetailResponseSchema },
          },
          handler: async ({ params, query, serviceContext, user }) => ({
            recording: await handleRecordingDetail({
              context: serviceContext,
              recordingId: params.recording_id,
              user,
              projectId: query.project_id,
            }),
          }),
        });
    },
  );
}
