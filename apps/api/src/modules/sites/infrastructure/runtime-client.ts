import { errorResponseSchema, type SiteRuntimeRequest } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import {
  getDurableObjectStub,
  postDurableObjectJson,
} from "~/infrastructure/durable-objects/client";
import type { IEnv } from "~/types";

export async function requestSiteRuntime<T>(
  env: IEnv,
  siteId: string,
  request: SiteRuntimeRequest,
  schema: z.ZodType<T>,
): Promise<T> {
  const stub = getDurableObjectStub(env.SITES_RUNTIME, siteId);

  if (!stub) {
    throw new AssistantError("App storage is not configured", ErrorType.CONFIGURATION_ERROR, 503);
  }

  const response = await postDurableObjectJson(stub, "https://sites-runtime", request);
  const body: unknown = await response.json();

  if (!response.ok) {
    const error = errorResponseSchema.parse(body);

    throw new AssistantError(error.error, z.enum(ErrorType).parse(error.type), response.status);
  }

  return schema.parse(body);
}
