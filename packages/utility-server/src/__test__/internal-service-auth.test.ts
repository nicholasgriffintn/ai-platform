import { describe, expect, it } from "vitest";

import {
  createInternalServiceDelegationToken,
  createInternalServiceToken,
  verifyInternalServiceDelegationJwt,
  verifyInternalServiceJwt,
} from "../internal-service-auth";

const SECRET = "internal-service-test-secret-with-at-least-32-bytes";
const DELEGATION_SECRET = "delegation-test-secret-with-at-least-32-bytes";

describe("internal service tokens", () => {
  it("signs short-lived service and user claims that the API can verify", async () => {
    const token = await createInternalServiceToken(SECRET, {
      service: "sandbox-worker",
      scopes: ["sandbox-preview:authorise"],
    });
    const claims = await verifyInternalServiceJwt(token, SECRET);

    expect(claims).toMatchObject({
      sub: "sandbox-worker",
      scopes: ["sandbox-preview:authorise"],
    });
    expect(claims.exp - claims.iat).toBe(30);
  });

  it("issues scoped user delegation claims without giving the worker signing authority", async () => {
    const token = await createInternalServiceDelegationToken(DELEGATION_SECRET, 42);
    const claims = await verifyInternalServiceDelegationJwt(token, DELEGATION_SECRET);

    expect(claims).toMatchObject({
      sub: "agent-worker",
      scopes: ["user:delegate"],
      user_id: 42,
    });
    expect(claims.exp - claims.iat).toBe(900);
    await expect(verifyInternalServiceJwt(token, SECRET)).rejects.toThrow();
    await expect(verifyInternalServiceDelegationJwt(token, SECRET)).rejects.toThrow();
  });

  it("rejects a token when the verifier uses a different secret", async () => {
    const token = await createInternalServiceToken(SECRET, {
      service: "sandbox-worker",
      scopes: ["sandbox-preview:authorise"],
    });

    await expect(
      verifyInternalServiceJwt(token, "a-different-internal-service-secret"),
    ).rejects.toThrow("JWT signature is invalid");
  });
});
