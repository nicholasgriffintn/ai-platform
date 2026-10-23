import { JSON_RPC_ERRORS } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { AssistantError, ErrorType } from "../errors";
import { dispatchJsonRpc, dispatchJsonRpcPayload, JsonRpcError } from "../json-rpc";

const handlers = {
  ping: () => ({}),
  echo: (params: unknown) => params,
  boom: () => {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "no");
  },
  denied: () => {
    throw new AssistantError("Approve it in Polychat", ErrorType.AUTHORISATION_ERROR, 403);
  },
  crash: () => {
    throw new Error("D1_ERROR: no such table: secrets");
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
      dispatchJsonRpc({ jsonrpc: "2.0", id: 3, method: "constructor" }, handlers),
    ).resolves.toMatchObject({ id: 3, error: { code: JSON_RPC_ERRORS.methodNotFound } });
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: 2, method: "boom" }, handlers),
    ).resolves.toMatchObject({
      id: 2,
      error: { code: JSON_RPC_ERRORS.invalidParams, message: "no" },
    });
    await expect(dispatchJsonRpc({ id: 4, method: "ping" }, handlers)).resolves.toMatchObject({
      id: null,
      error: { code: JSON_RPC_ERRORS.invalidRequest },
    });
  });

  it("keeps user-facing errors and hides internal ones", async () => {
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: 1, method: "denied" }, handlers),
    ).resolves.toMatchObject({ error: { message: "Approve it in Polychat" } });
    await expect(
      dispatchJsonRpc({ jsonrpc: "2.0", id: 2, method: "crash" }, handlers),
    ).resolves.toMatchObject({
      error: { code: JSON_RPC_ERRORS.internal, message: "The request failed" },
    });
  });

  it("swallows notifications, even unknown or failing ones", async () => {
    await expect(dispatchJsonRpc({ jsonrpc: "2.0", method: "boom" }, handlers)).resolves.toBeNull();
    await expect(
      dispatchJsonRpcPayload(
        [
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", id: 7, method: "ping" },
        ],
        handlers,
      ),
    ).resolves.toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
  });
});
