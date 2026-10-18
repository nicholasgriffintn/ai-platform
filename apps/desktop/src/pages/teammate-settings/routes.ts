import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  `${getPlacePaths("chat").teammates}/:teammateId/settings`,
  { path: `${PROJECT_PATH}/teammates/:teammateId/settings`, layout: "work" },
] as const;

export const layout = "chat";
