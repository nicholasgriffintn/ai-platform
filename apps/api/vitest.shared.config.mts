import { splitTestFilesByIsolation } from "@ngriffin_uk/polychat-config/vitest/isolation";
import { defineConfig } from "vitest/config";

import { apiTestProject } from "./vitest.project.mjs";

export default defineConfig(
  apiTestProject({
    name: "api:shared-registry",
    include: splitTestFilesByIsolation(import.meta.dirname).shared,
    isolate: false,
  }),
);
