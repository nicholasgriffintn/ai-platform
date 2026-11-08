import { describe, expect, it, vi } from "vitest";

import { createPolychatClient } from "./http.js";

describe("createPolychatClient", () => {
  it.each(["https://attacker.example/messages", "//attacker.example/messages"])(
    "rejects cross-origin request path %s before resolving credentials",
    async (path) => {
      const fetch = vi.fn();
      const getHeaders = vi.fn(() => ({ Authorization: "Bearer secret" }));
      const client = createPolychatClient({
        baseUrl: "https://api.polychat.test",
        fetch,
        getHeaders,
      });

      await expect(client.fetch(path)).rejects.toThrow("must remain on the configured API origin");
      expect(fetch).not.toHaveBeenCalled();
      expect(getHeaders).not.toHaveBeenCalled();
    },
  );
});
