import { apiKeyService } from "@ngriffin_uk/polychat-library-client";

import { createDesktopAccessToken } from "./access-token";
import { tauriDesktopBackend } from "./desktop-backend";

export const desktopAccessToken = createDesktopAccessToken({
  issue: () => tauriDesktopBackend.accessToken(),
  isSignedIn: () => tauriDesktopBackend.isSignedIn(),
});

apiKeyService.setTokenSource(desktopAccessToken.current);
