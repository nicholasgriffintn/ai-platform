import { apiKeyService } from "~/lib/api/api-key";
import { useCaptchaStore } from "~/state/stores/captchaStore";

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

    return headers;
  } catch (error) {
    console.error("Error getting headers:", error);
    return {};
  }
}
