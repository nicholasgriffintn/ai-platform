import { describe, expect, it } from "vitest";

import { joinConnectorCredential } from "../connector-credentials.js";
import type { ApiKeyConnectorConfig } from "../providers.js";

const keyAndSecret: ApiKeyConnectorConfig = {
  authType: "api_key",
  credentialFields: [
    { label: "API key", secret: true },
    { label: "API secret", secret: true },
  ],
  credentialSeparator: ":",
  scopes: [],
};

describe("joinConnectorCredential", () => {
  it("joins trimmed parts in the stored format", () => {
    expect(joinConnectorCredential(keyAndSecret, [" key ", "secret\n"])).toBe("key:secret");
  });

  it("rejects missing parts", () => {
    expect(() => joinConnectorCredential(keyAndSecret, ["key", "  "])).toThrow(
      "Enter api key and api secret",
    );
    expect(() => joinConnectorCredential(keyAndSecret, ["key"])).toThrow();
  });

  it("rejects parts that contain the separator", () => {
    expect(() => joinConnectorCredential(keyAndSecret, ["key:extra", "secret"])).toThrow(
      'cannot contain ":"',
    );
  });
});
