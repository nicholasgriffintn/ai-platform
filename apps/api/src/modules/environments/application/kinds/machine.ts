import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { forgetMachine, listMachines } from "~/modules/machines/application";

import type { EnvironmentKindDefinition } from "../../domain/environment-kind";

export const machineEnvironments: EnvironmentKindDefinition<"machine"> = {
  kind: "machine",
  actions: new Set(),
  async read({ context, user }, id) {
    const machine = (await listMachines(context, user.id)).find(
      (candidate) => candidate.machineId === id,
    );

    if (!machine) {
      throw new AssistantError("Environment not found", ErrorType.NOT_FOUND, 404);
    }

    return { object: "environment", id, kind: "machine", detail: machine };
  },
  remove: ({ context, user }, id) => forgetMachine(context, id, user.id),
};
