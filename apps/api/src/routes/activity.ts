import { Hono } from "hono";
import z from "zod/v4";
import {
	activityListQuerySchema,
	activityListResponseSchema,
	activityRecordSchema,
} from "@ngriffin_uk/polychat-schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import { getActivity, listActivity } from "~/services/activity";

const app = new Hono();
addRoute(app, "get", "/", {
	tags: ["activity"],
	auth: true,
	querySchema: activityListQuerySchema,
	responses: { 200: { description: "Activity", schema: activityListResponseSchema } },
	handler: ({ query, serviceContext, user }) => listActivity(serviceContext, user.id, query),
});
addRoute(app, "get", "/:activityId", {
	tags: ["activity"],
	auth: true,
	paramSchema: z.object({ activityId: z.string().min(1) }),
	responses: { 200: { description: "Activity record", schema: activityRecordSchema } },
	handler: ({ params, serviceContext, user }) =>
		getActivity(serviceContext, user.id, params.activityId),
});
export default app;
