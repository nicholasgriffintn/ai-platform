import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  `${getPlacePaths("chat").files}/*`,
  { path: `${PROJECT_PATH}/files/*`, layout: "work" },
] as const;

export const layout = "chat";
