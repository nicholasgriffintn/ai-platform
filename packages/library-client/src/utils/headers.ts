import { DEVICE_SYNC_DEVICE_ID_HEADER } from "@ngriffin_uk/polychat-schemas";
import { isCookieSameSite } from "@ngriffin_uk/polychat-utility-core";

import { apiKeyService } from "../api-key.js";
import { useCaptchaStore } from "../captchaStore.js";
import { API_BASE_URL } from "../constants.js";
import { getDeviceId } from "../sync/device-identity.js";

export async function getHeaders(): Promise<Record<string, string>> {
  try {
    const headers: Record<string, string> = {};

    const apiKey = await apiKeyService.getApiKey();

    const isRunningOnTheSameOrigin = isCookieSameSite(globalThis.location?.origin, API_BASE_URL);

    if (apiKey && !isRunningOnTheSameOrigin) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const captchaToken = useCaptchaStore.getState().captchaToken;

    if (captchaToken) {
      headers["X-Captcha-Token"] = captchaToken;
    }

    const deviceId = getDeviceId();

    if (deviceId) {
      headers[DEVICE_SYNC_DEVICE_ID_HEADER] = deviceId;
    }

    return headers;
  } catch (error) {
    console.error("Error getting headers:", error);

    return {};
  }
}
