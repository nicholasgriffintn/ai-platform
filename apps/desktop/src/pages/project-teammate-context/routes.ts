import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [`${PROJECT_PATH}/teammates/:teammateId/context`] as const;

export const layout = "work";
