import { reactTestConfig } from "@ngriffin_uk/polychat-config/vitest/react";
import { workspaceSourceResolve } from "@ngriffin_uk/polychat-config/vitest/workspace";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...workspaceSourceResolve,
  test: { ...reactTestConfig, setupFiles: ["./src/test/setup.ts"] },
});
