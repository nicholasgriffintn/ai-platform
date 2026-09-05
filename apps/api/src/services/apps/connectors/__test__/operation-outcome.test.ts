import { describe, expect, it } from "vitest";

import type { ConnectorOperationConfig } from "~/lib/providers/capabilities/connectors";
import { AssistantError, ErrorType } from "~/utils/errors";

import { normaliseConnectorOperationFailure } from "../operation-outcome";

const readOperation: ConnectorOperationConfig = { id: "list_items", access: "read" };
const writeOperation: ConnectorOperationConfig = { id: "create_item", access: "write" };
const idempotentWriteOperation: ConnectorOperationConfig = {
  id: "set_item",
  access: "write",
  idempotent: true,
};

describe("normaliseConnectorOperationFailure", () => {
  it("leaves reads and definitive write failures unchanged", () => {
    const networkError = new AssistantError("offline", ErrorType.NETWORK_ERROR, 502);
    const invalidError = new AssistantError("invalid", ErrorType.PARAMS_ERROR, 400);
    const externalValidationError = new AssistantError(
      "provider rejected input",
      ErrorType.EXTERNAL_API_ERROR,
      400,
    );

    expect(
      normaliseConnectorOperationFailure({
        provider: "Example",
        operation: readOperation,
        error: networkError,
      }),
    ).toBe(networkError);
    expect(
      normaliseConnectorOperationFailure({
        provider: "Example",
        operation: writeOperation,
        error: invalidError,
      }),
    ).toBe(invalidError);
    expect(
      normaliseConnectorOperationFailure({
        provider: "Example",
        operation: writeOperation,
        error: externalValidationError,
      }),
    ).toBe(externalValidationError);
  });

  it("blocks a blind repeat when a non-idempotent write outcome is unknown", () => {
    const failure = normaliseConnectorOperationFailure({
      provider: "Example",
      operation: writeOperation,
      error: new TypeError("connection closed"),
    });

    expect(failure).toMatchObject({
      type: ErrorType.EXTERNAL_API_ERROR,
      context: {
        outcome: "unknown",
        retryable: false,
        provider: "Example",
        operation: "create_item",
      },
    });
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", expect.stringContaining("may have completed"));
  });

  it("allows one exact repeat when an idempotent write outcome is unknown", () => {
    const failure = normaliseConnectorOperationFailure({
      provider: "Example",
      operation: idempotentWriteOperation,
      error: new AssistantError("timed out", ErrorType.NETWORK_ERROR, 504),
    });

    expect(failure).toMatchObject({
      context: { outcome: "unknown", retryable: true, operation: "set_item" },
    });
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", expect.stringContaining("same parameters"));
  });

  it("marks a definitive rate-limit rejection as safe to repeat once", () => {
    const failure = normaliseConnectorOperationFailure({
      provider: "Example",
      operation: writeOperation,
      error: new AssistantError("busy", ErrorType.RATE_LIMIT_ERROR, 429),
    });

    expect(failure).toMatchObject({ context: { outcome: "not_applied", retryable: true } });
  });
});
