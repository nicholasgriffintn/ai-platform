import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  `${MODE_BASE_PATHS.chat}/apps/:appId/*`,
  { path: `${PROJECT_PATH}/apps/:appId/*`, layout: "work" },
] as const;

export const layout = "chat";
