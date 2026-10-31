import { initSentry } from "@ngriffin_uk/polychat-library-client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import "./styles/index.css";

initSentry({ app: "web", release: `polychat-web@${__POLYCHAT_BUILD_ID__}` });

hydrateRoot(
  document,
  <StrictMode>
    <HydratedRouter />
  </StrictMode>,
);
