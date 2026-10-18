import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [
  getPlacePaths("chat").teammates,
  { path: `${PROJECT_PATH}/teammates`, layout: "work" },
] as const;

export const layout = "chat";
