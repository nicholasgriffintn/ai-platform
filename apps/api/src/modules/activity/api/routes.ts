import {
  activityListQuerySchema,
  activityListResponseSchema,
  activityRecordSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { getActivity, listActivity } from "~/modules/activity/application";

const app = new Hono();

defineResource(app, { idParam: "activity_id", tags: ["activity"] }, (activity) => {
  activity
    .list({
      auth: true,
      summary: "List activity",
      description: "Personal activity, or a project's when project_id is set. Newest first.",
      querySchema: activityListQuerySchema,
      responses: { 200: { description: "Activity", schema: activityListResponseSchema } },
      handler: ({ query, serviceContext, user }) => listActivity(serviceContext, user.id, query),
    })
    .read({
      auth: true,
      summary: "Read an activity record",
      paramSchema: z.object({ activity_id: z.string().min(1) }),
      responses: { 200: { description: "Activity record", schema: activityRecordSchema } },
      handler: ({ params, serviceContext, user }) =>
        getActivity(serviceContext, user.id, params.activity_id),
    });
});

export default app;
