import { JSON_RPC_ERRORS } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { AssistantError, ErrorType } from "../errors";
import { dispatchJsonRpc, JsonRpcError } from "../json-rpc";

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
});
