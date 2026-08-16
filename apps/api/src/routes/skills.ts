import { Hono } from "hono";
import z from "zod/v4";

import {
	errorResponseSchema,
	skillAvailabilityResponseSchema,
	skillAvailabilitySchema,
	setSkillEnabledSchema,
} from "@ngriffin_uk/polychat-schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getPersonalSkillAvailability, setPersonalSkillEnabled } from "~/services/skills";

const app = new Hono();
const routeLogger = createRouteLogger("skills");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing skills route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	auth: true,
	tags: ["skills"],
	summary: "List personal skill availability",
	description:
		"Returns every skill with whether it is ready for this user's own conversations. Project skills are managed through project capabilities.",
	responses: {
		200: { description: "Skill availability", schema: skillAvailabilityResponseSchema },
	},
	handler: async ({ serviceContext, user }) => ({
		skills: await getPersonalSkillAvailability(serviceContext, user.id),
	}),
});

addRoute(app, "put", "/:id", {
	auth: true,
	tags: ["skills"],
	summary: "Enable or disable a skill",
	description:
		"Turns a skill on or off for this user's own conversations. Always-on skills cannot be changed.",
	paramSchema: z.object({ id: z.string().min(1) }),
	bodySchema: setSkillEnabledSchema,
	responses: {
		200: { description: "Updated skill", schema: skillAvailabilitySchema },
		400: { description: "Skill cannot be changed", schema: errorResponseSchema },
		404: { description: "Unknown skill", schema: errorResponseSchema },
	},
	handler: async ({ body, params, serviceContext, user }) =>
		setPersonalSkillEnabled(serviceContext, user.id, params.id, body.enabled),
});

export default app;
