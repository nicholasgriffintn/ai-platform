import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getCapabilityOpenPath, PERSONAL_SURFACE } from "../capability-surfaces.js";

function teammateItem(availability: "available" | "unavailable"): AssistantActionItem {
  return {
    kind: "teammate",
    capability: { id: "researcher", availability },
    metadata: { teammateId: "researcher" },
  } as unknown as AssistantActionItem;
}

describe("capability surfaces", () => {
  it("offers no way in to a capability the scope cannot run", () => {
    expect(getCapabilityOpenPath(teammateItem("unavailable"), PERSONAL_SURFACE, [])).toBeNull();
  });
});
