import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

export const WORK_BASE_PATH = MODE_BASE_PATHS.work;

export const WORKSPACE_PATH = `${WORK_BASE_PATH}/:workspaceId`;

export const PROJECT_PATH = `${WORKSPACE_PATH}/projects/:projectId`;
