import { describe, expect, it } from "vitest";
import z from "zod/v4";

import {
  recoveryTelemetryQueryFields,
  validateRecoveryTelemetryQuery,
} from "../recovery-telemetry-query";

const schema = z.object(recoveryTelemetryQueryFields).superRefine(validateRecoveryTelemetryQuery);

describe("recovery telemetry query", () => {
  it("requires one complete attempt identity", () => {
    expect(schema.safeParse({ recovery_platform: "web" }).success).toBe(false);
    expect(
      schema.safeParse({
        recovery_platform: "web",
        recovery_attempt: "2",
        recovery_elapsed_ms: "4000",
        recovery_known_assistant_count: "1",
        recovery_final_attempt: "false",
      }).success,
    ).toBe(true);
  });
});
