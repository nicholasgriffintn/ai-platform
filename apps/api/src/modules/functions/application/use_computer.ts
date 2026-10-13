import { computerUseInputSchema } from "@ngriffin_uk/polychat-schemas";

import { executeComputerControl } from "~/modules/computer-use/application/interactive";
import { executeComputerTask } from "~/modules/computer-use/application/tasks";
import type { ApiToolDefinition } from "~/types/functions";

import { use_computer as descriptor } from "./definitions/use_computer";

export const use_computer: ApiToolDefinition = {
  ...descriptor,
  execute: async (args, toolContext) => {
    const input = computerUseInputSchema.parse(args);

    return input.provider === "hosted"
      ? executeComputerControl(input, toolContext)
      : executeComputerTask(input, toolContext);
  },
};
