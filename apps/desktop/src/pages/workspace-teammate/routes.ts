import { WORKSPACE_PATH } from "../../infrastructure/route-patterns";

export const paths = [`${WORKSPACE_PATH}/team/:teammateId`] as const;

export const layout = "work";
