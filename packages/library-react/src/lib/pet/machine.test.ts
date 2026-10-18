import { describe, expect, it } from "vitest";

import { settlePetMotion, startPetMotion, stepPetMotion } from "./machine.js";

describe("pet motion", () => {
  it("holds a state for the minimum dwell so rapid tool calls do not strobe", () => {
    const working = startPetMotion("work", 0);
    const flicker = stepPetMotion(working, "think", 100, 700);

    expect(flicker.shown).toBe("work");
    expect(flicker.queued).toBe("think");
    expect(settlePetMotion(flicker, 500, 700).shown).toBe("work");
    expect(settlePetMotion(flicker, 700, 700)).toEqual({
      shown: "think",
      since: 700,
      queued: null,
    });
  });

  it("drops a queued state when the target returns to what is shown", () => {
    const queued = stepPetMotion(startPetMotion("work", 0), "think", 100, 700);

    expect(stepPetMotion(queued, "work", 200, 700).queued).toBeNull();
  });

  it("lets urgent states interrupt the dwell", () => {
    const working = startPetMotion("work", 0);

    expect(stepPetMotion(working, "fret", 50, 700).shown).toBe("fret");
    expect(stepPetMotion(working, "listen", 50, 700).shown).toBe("listen");
    expect(stepPetMotion(working, "review", 50, 700).shown).toBe("review");
  });
});
