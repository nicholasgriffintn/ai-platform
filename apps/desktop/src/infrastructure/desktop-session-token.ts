import { apiKeyService, setMediaBaseUrl } from "@ngriffin_uk/polychat-library-client";

import { createDesktopAccessToken } from "./access-token";
import { tauriDesktopBackend } from "./desktop-backend";
import { DESKTOP_MEDIA_BASE_URL } from "./desktop-media";

export const desktopAccessToken = createDesktopAccessToken({
  issue: () => tauriDesktopBackend.accessToken(),
  isSignedIn: () => tauriDesktopBackend.isSignedIn(),
});

apiKeyService.setTokenSource(desktopAccessToken.current);
setMediaBaseUrl(DESKTOP_MEDIA_BASE_URL);
