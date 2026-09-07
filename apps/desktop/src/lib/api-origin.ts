import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { isSameOrigin } from "@ngriffin_uk/polychat-schemas";

export function getApiOriginMismatch(hostApiBaseUrl: string): string | null {
  if (isSameOrigin(hostApiBaseUrl, API_BASE_URL)) {
    return null;
  }

  return `This build signs in against ${hostApiBaseUrl} but calls ${API_BASE_URL}. Build the window and the desktop host against the same API.`;
}
