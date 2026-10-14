import {
  mobilePushDeviceParamsSchema,
  registerMobilePushDeviceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";

const app = new Hono();

defineResource(app, { idParam: "device_id", tags: ["devices"] }, (devices) => {
  devices
    .create({
      auth: true,
      summary: "Register an iOS push device",
      description: "Registering the same token again refreshes it.",
      bodySchema: registerMobilePushDeviceSchema,
      handler: async ({ body, serviceContext, user }) => {
        await serviceContext.repositories.mobilePush.register(user.id, body);

        return { id: body.token, registered: true };
      },
    })
    .delete({
      auth: true,
      summary: "Unregister an iOS push device",
      description: "The device id is the push token it registered with.",
      paramSchema: mobilePushDeviceParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await serviceContext.repositories.mobilePush.unregister(user.id, params.device_id);

        return { deleted: true };
      },
    });
});

export default app;
