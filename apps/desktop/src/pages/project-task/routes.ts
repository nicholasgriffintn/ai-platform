import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [`${PROJECT_PATH}/tasks/:taskId`] as const;

export const layout = "work";
