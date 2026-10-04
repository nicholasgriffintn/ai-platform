import { packageTaskConfig } from "@ngriffin_uk/polychat-config/tasks";

const config = packageTaskConfig({ build: "tsc -p tsconfig.json && pnpm build:runtime" });

config.run.tasks.build.input.push(
  "src/**",
  "scripts/**",
  "vite.config.ts",
  "package.json",
  "tsconfig*.json",
);

export default config;
