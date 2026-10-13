import { workspaceSourceResolve } from "@ngriffin_uk/polychat-config/vitest/workspace";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...workspaceSourceResolve,
  test: {
    environment: "jsdom",
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        test: { name: "react", environment: "jsdom", include: ["src/**/*.test.tsx"] },
      },
    ],
  },
});
