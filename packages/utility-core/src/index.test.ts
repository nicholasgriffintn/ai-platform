import { describe, expect, it } from "vitest";

import { escapeHtml } from "./index";

describe("utility-core", () => {
  it("escapes every character that could break out of markup or an attribute", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;",
    );
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
