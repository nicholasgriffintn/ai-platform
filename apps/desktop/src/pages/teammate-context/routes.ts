import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

export const paths = [`${getPlacePaths("chat").teammates}/:teammateId/context`] as const;

export const layout = "chat";
