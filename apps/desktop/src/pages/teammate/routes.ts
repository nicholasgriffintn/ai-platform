import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";

export const paths = [`${getPlacePaths("chat").teammates}/:teammateId`] as const;
