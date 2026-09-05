import {
  registerMobilePushDeviceSchema,
  unregisterMobilePushDeviceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";

const app = new Hono();

addRoute(app, "put", "/", {
  tags: ["user"],
  summary: "Register an iOS push device",
  auth: true,
  bodySchema: registerMobilePushDeviceSchema,
  responses: { 200: { description: "Push device registered" } },
  handler: async ({ body, serviceContext, user }) => {
    await serviceContext.repositories.mobilePush.register(user.id, body);

    return { registered: true };
  },
});

addRoute(app, "delete", "/", {
  tags: ["user"],
  summary: "Unregister an iOS push device",
  auth: true,
  bodySchema: unregisterMobilePushDeviceSchema,
  responses: { 200: { description: "Push device unregistered" } },
  handler: async ({ body, serviceContext, user }) => {
    await serviceContext.repositories.mobilePush.unregister(user.id, body.token);

    return { unregistered: true };
  },
});

export default app;
