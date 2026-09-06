import { runsOnDevice, selectModelsForSurface } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { filterModelsForUserAccess, getModels } from ".";
import { getExecutableModelsForAccount } from "./policy";

const env = { ALWAYS_ENABLED_PROVIDERS: "" } as never;

function deviceModels(models: Record<string, { runsOn?: string }>) {
  return Object.entries(models).filter(([, model]) => runsOnDevice(model as never));
}

describe("device models on the desktop surface", () => {
  it("offers a device runtime without a provider key or a paid plan", async () => {
    const desktop = selectModelsForSurface(getModels({ shouldUseCache: false }), "desktop");
    const available = await filterModelsForUserAccess(desktop, env, undefined, {
      shouldUseCache: false,
    });
    const executable = getExecutableModelsForAccount(available);

    expect(deviceModels(desktop).length).toBeGreaterThan(0);
    expect(deviceModels(available).length).toBe(deviceModels(desktop).length);
    expect(deviceModels(executable).length).toBe(deviceModels(desktop).length);
  });

  it("never offers one to the web, which cannot reach the runtime", async () => {
    const web = selectModelsForSurface(getModels({ shouldUseCache: false }), "web");
    const available = await filterModelsForUserAccess(web, env, undefined, {
      shouldUseCache: false,
    });

    expect(deviceModels(web)).toHaveLength(0);
    expect(deviceModels(available)).toHaveLength(0);
  });
});
