import { PROJECT_PATH } from "../../lib/route-patterns";

export const paths = [`${PROJECT_PATH}/apps/:appId/*`] as const;

export const layout = "work";
