import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

export const paths = [getPlacePaths("chat").scheduled] as const;

export const layout = "chat";
