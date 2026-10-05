import { createContext, useContext } from "react";

import type { SiteRecordExecutor } from "./useSiteFrameBridge.js";

export interface SiteRecordRuntime {
  revision: number | null;
  execute: SiteRecordExecutor;
}
const context = createContext<SiteRecordRuntime | null>(null);

export const SiteRecordProvider = context.Provider;
export const useSiteRecordRuntime = () => useContext(context);
