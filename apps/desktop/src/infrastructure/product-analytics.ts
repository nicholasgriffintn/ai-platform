import { setAnalyticsApp } from "@ngriffin_uk/polychat-library-client";

import { tauriDesktopBackend } from "./desktop-backend";

setAnalyticsApp("desktop");

void tauriDesktopBackend
  .collectDiagnostics()
  .then((diagnostics) => setAnalyticsApp("desktop", diagnostics.appVersion))
  .catch(() => undefined);
