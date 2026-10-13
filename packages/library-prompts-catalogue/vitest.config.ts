import { workspaceSourceResolve } from "@ngriffin_uk/polychat-config/vitest/workspace";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...workspaceSourceResolve,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
