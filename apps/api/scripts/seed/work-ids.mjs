import { seedId } from "./sql.mjs";

export const WORKSPACE_ID = seedId("workspace", "northstar");

export const PROJECTS = {
  launch: seedId("project", "autumn-launch"),
  website: seedId("project", "website-refresh"),
  support: seedId("project", "support-desk"),
  company: seedId("project", "company"),
  pilot: seedId("project", "pilot"),
};

export const INITIATIVES = {
  release: seedId("initiative", "autumn-release"),
  growth: seedId("initiative", "sign-ups"),
  support: seedId("initiative", "support-in-a-day"),
};

export const WORK_TEAMMATES = {
  atlas: seedId("teammate", "atlas"),
  mara: seedId("teammate", "mara"),
  juno: seedId("teammate", "juno"),
  quinn: seedId("teammate", "quinn"),
};

export function workContextId(key) {
  return seedId("teammate-context", key, "northstar");
}

export function taskId(projectKey, number) {
  return seedId("task", projectKey, String(number));
}
