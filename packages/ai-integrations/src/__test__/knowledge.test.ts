import { expect, it } from "vitest";

import { getConnectorKnowledgeAdapter } from "../knowledge.js";

it("normalises published storage pages, validates identity and preserves explicit removal states", () => {
  const adapter = getConnectorKnowledgeAdapter("confluence-page");

  if (!adapter) {
    throw new Error("Missing adapter");
  }

  const data = {
    id: "1",
    title: "Runbook",
    status: "current",
    version: { number: 4 },
    body: {
      storage: {
        value: "<p>Restart &amp; verify</p><script>ignored()</script><pre>service restart</pre>",
      },
    },
    _links: { base: "https://example.test/wiki", webui: "/wiki/pages/1" },
  };

  expect(adapter.normalise({ data }, "1")).toMatchObject({
    content: "Restart & verify\nservice restart",
    upstreamRevision: 4,
    externalUri: "https://example.test/wiki/pages/1",
  });
  expect(() => adapter.normalise({ data }, "2")).toThrow("different page");
  expect(() => adapter.normalise({ ...data, body: undefined }, "1")).toThrow("storage body");
  expect(adapter.normalise({ ...data, status: "trashed" }, "1").status).toBe("archived");
});
