import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

export const paths = [getPlacePaths("chat").plugins] as const;

export const layout = "chat";
