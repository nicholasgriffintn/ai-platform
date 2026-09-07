import { packageTaskConfig } from "@ngriffin_uk/polychat-config/tasks";

export default packageTaskConfig({ build: ["tsup", "vite build --config vite.styles.config.ts"] });
