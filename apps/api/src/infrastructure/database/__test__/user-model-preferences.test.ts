import { updateUserSettingsSchema } from "@ngriffin_uk/polychat-schemas";
import { expect, it } from "vitest";

import { prepareUserSettingsUpdates } from "../user-settings";

it("clears the sandbox model when the user chooses to follow the tier", () => {
  const request = updateUserSettingsSchema.parse({ sandbox_model: null });

  expect(prepareUserSettingsUpdates(request)).toEqual({ sandbox_model: null });
});
