import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [`${PROJECT_PATH}/apps/:appId/*`] as const;

export const layout = "work";
