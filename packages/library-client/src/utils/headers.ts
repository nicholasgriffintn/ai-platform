import { DEVICE_SYNC_DEVICE_ID_HEADER } from "@ngriffin_uk/polychat-schemas";

import { apiKeyService } from "../api-key.js";
import { useCaptchaStore } from "../captchaStore.js";
import { getDeviceId } from "../sync/device-identity.js";

export async function getHeaders(): Promise<Record<string, string>> {
  try {
    const headers: Record<string, string> = {};

    const apiKey = await apiKeyService.getApiKey();

    if (apiKey) {
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
