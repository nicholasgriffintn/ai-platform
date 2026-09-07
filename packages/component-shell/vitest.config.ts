import { reactTestConfig } from "@ngriffin_uk/polychat-config/vitest/react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { ...reactTestConfig, setupFiles: ["./src/test/setup.ts"] },
});
