import { packageTaskConfig } from "@ngriffin_uk/polychat-config/tasks";

export default packageTaskConfig({
  build: [
    "tsup",
    "tsup --config tsup.preview.config.ts",
    "vite build --config vite.styles.config.ts",
  ],
});
