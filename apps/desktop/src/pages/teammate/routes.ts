import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  `${getPlacePaths("chat").teammates}/:teammateId`,
  { path: `${PROJECT_PATH}/teammates/:teammateId`, layout: "work" },
] as const;
