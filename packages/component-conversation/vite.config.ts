import { packageTaskConfig } from "@ngriffin_uk/polychat-config/tasks";

export default packageTaskConfig({
  build: ["tsc -p tsconfig.json", "vite build --config vite.styles.config.ts"],
});
