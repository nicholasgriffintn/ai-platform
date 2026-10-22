import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  `${getPlacePaths("chat").teammates}/:teammateId/context`,
  { path: `${PROJECT_PATH}/teammates/:teammateId/context`, layout: "work" },
] as const;

export const layout = "chat";
