import { fileURLToPath } from "node:url";

export const reactTestConfig = {
  environment: "jsdom",
  exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
  setupFiles: [fileURLToPath(new URL("./react-setup.js", import.meta.url))],
};
