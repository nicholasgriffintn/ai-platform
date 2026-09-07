import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

export const paths = [MODE_BASE_PATHS.chat, `${MODE_BASE_PATHS.chat}/:completionId`] as const;
