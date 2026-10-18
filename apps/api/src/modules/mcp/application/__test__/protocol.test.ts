import { describe, expect, it } from "vitest";

import { dispatchJsonRpc, JSON_RPC_ERRORS, JsonRpcError } from "../protocol";

const handlers = {
  ping: () => ({}),
  echo: (params: unknown) => params,
  boom: () => {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "no");
  },
};

describe("dispatchJsonRpc", () => {
  it("returns results, method errors and typed errors with the request id", async () => {
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: 1, method: "echo", params: { a: 1 } }, handlers),
    ).resolves.toEqual({ jsonrpc: "2.0", id: 1, result: { a: 1 } });
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: "x", method: "missing" }, handlers),
    ).resolves.toMatchObject({ id: "x", error: { code: JSON_RPC_ERRORS.methodNotFound } });
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: 2, method: "boom" }, handlers),
    ).resolves.toMatchObject({
      id: 2,
      error: { code: JSON_RPC_ERRORS.invalidParams, message: "no" },
    });
  });

  it("swallows notifications, even unknown or failing ones", async () => {
    await expect(dispatchJsonRpc({ jsonrpc: "2.0", method: "boom" }, handlers)).resolves.toBeNull();
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, handlers),
    ).resolves.toBeNull();
  });
});
