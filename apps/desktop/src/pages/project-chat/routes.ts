import { PROJECT_PATH } from "../../lib/route-patterns";

export const paths = [`${PROJECT_PATH}/chat`, `${PROJECT_PATH}/chat/:conversationId`] as const;
