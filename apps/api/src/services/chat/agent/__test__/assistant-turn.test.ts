import { describe, expect, it } from "vitest";

import { usageReservationOutcome } from "~/services/chat/agent/assistant-turn";

describe("usageReservationOutcome", () => {
  it("settles only after usage is durably queued or written", () => {
    expect(usageReservationOutcome("queued")).toBe("settled");
    expect(usageReservationOutcome("written")).toBe("settled");
  });

  it("releases when provider usage is missing or failed", () => {
    expect(usageReservationOutcome("skipped")).toBe("released");
    expect(usageReservationOutcome("failed")).toBe("released");
  });
});
