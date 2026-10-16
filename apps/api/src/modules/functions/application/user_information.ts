import type { ApiToolDefinition } from "~/types/functions";

import { get_user_information as get_user_informationDescriptor } from "./definitions/user_information";
import { resolveUserCoordinates } from "./user-location";

export const get_user_information: ApiToolDefinition = {
  ...get_user_informationDescriptor,
  execute: async (_args, context) => {
    const user = context.request.user;
    const settings = user?.id ? await context.request.context?.getUserSettings?.() : null;
    const coordinates = resolveUserCoordinates(context.request);
    const data = {
      coordinates,
      profileLocation: user?.location ?? null,
      name: user?.name ?? null,
      nickname: settings?.nickname ?? null,
      jobRole: settings?.job_role ?? null,
    };

    return {
      status: "success",
      name: get_user_informationDescriptor.name,
      content: coordinates
        ? `User is near ${coordinates.latitude}, ${coordinates.longitude} (${coordinates.source}).`
        : "The user's coordinates are not available.",
      data,
    };
  },
};
