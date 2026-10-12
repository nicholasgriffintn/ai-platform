import {
  DEVICE_CODE_GRANT_TYPE,
  deviceCodeResponseSchema,
  deviceTokenErrorSchema,
  deviceTokenResponseSchema,
  type DeviceCodeResponse,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { CliError } from "./errors.js";
import { requestJson, type Fetch, type JsonResponse } from "./http.js";

const SLOW_DOWN_STEP_SECONDS = 5;

const pollErrorSchema = z.object({ error: deviceTokenErrorSchema });
const apiErrorSchema = z.object({ message: z.string().min(1) });

function describeFailure(response: JsonResponse, action: string): CliError {
  const parsed = apiErrorSchema.safeParse(response.body);

  return new CliError(
    parsed.success
      ? `${action} failed: ${parsed.data.message}`
      : `${action} failed with HTTP ${response.status}.`,
  );
}

export async function requestDeviceCode(
  fetchImpl: Fetch,
  apiBaseUrl: string,
  clientName: string,
): Promise<DeviceCodeResponse> {
  const response = await requestJson(fetchImpl, `${apiBaseUrl}/auth/device/code`, {
    method: "POST",
    body: { client_name: clientName },
  });

  if (!response.ok) {
    throw describeFailure(response, "Starting sign-in");
  }

  const parsed = deviceCodeResponseSchema.safeParse(response.body);

  if (!parsed.success) {
    throw new CliError("Polychat answered with something that is not a device code.");
  }

  return parsed.data;
}

export interface WaitForApprovalOptions {
  fetch: Fetch;
  apiBaseUrl: string;
  deviceCode: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
}

export async function waitForDeviceApproval(options: WaitForApprovalOptions): Promise<string> {
  const deadline = options.now() + options.expiresInSeconds * 1000;
  let intervalSeconds = options.intervalSeconds;

  for (;;) {
    await options.sleep(intervalSeconds * 1000);

    if (options.now() >= deadline) {
      break;
    }

    const response = await requestJson(options.fetch, `${options.apiBaseUrl}/auth/device/token`, {
      method: "POST",
      body: { grant_type: DEVICE_CODE_GRANT_TYPE, device_code: options.deviceCode },
    });

    if (response.ok) {
      const token = deviceTokenResponseSchema.safeParse(response.body);

      if (!token.success) {
        throw new CliError("Polychat approved the device but did not return a usable key.");
      }

      return token.data.access_token;
    }

    const pollError = pollErrorSchema.safeParse(response.body);

    if (!pollError.success) {
      throw describeFailure(response, "Checking for approval");
    }

    switch (pollError.data.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        intervalSeconds += SLOW_DOWN_STEP_SECONDS;
        continue;
      case "access_denied":
        throw new CliError("Sign-in was refused in the browser. Nothing was issued.");
      case "expired_token":
        throw new CliError("The code expired before it was approved. Run login again.");
      case "invalid_grant":
        throw new CliError("Polychat no longer recognises this sign-in. Run login again.");
    }
  }

  throw new CliError("The code expired before it was approved. Run login again.");
}
