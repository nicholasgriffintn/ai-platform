import { packageTaskConfig } from "@ngriffin_uk/polychat-config/tasks";

export default packageTaskConfig({
  build: "tsc -p tsconfig.json && node ./scripts/build-resolved-catalogue.mjs",
});
