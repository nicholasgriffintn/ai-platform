import { PROJECT_PATH } from "../../infrastructure/route-patterns";

export const paths = [`${PROJECT_PATH}/chat`, `${PROJECT_PATH}/chat/:conversationId`] as const;

export const layout = "work";
