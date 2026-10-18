import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  getPlacePaths("chat").scheduled,
  { path: `${PROJECT_PATH}/scheduled`, layout: "work" },
] as const;

export const layout = "chat";
