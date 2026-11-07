import { describe, expect, it } from "vitest";

import { buildSiteFrameDocument } from "../preview-document.js";

const options = {
  frameId: "frame-1",
  title: "Preview",
  fontUrl: "https://fonts.example/css",
  runtimeUrl: "/runtime.js",
  stylesheetUrl: "/styles.css",
};

describe("buildSiteFrameDocument", () => {
  it("tells the parent when the runtime cannot load", () => {
    const document = buildSiteFrameDocument({
      ...options,
      runtimeFailureMessage: { type: "runtime-failed", frameId: "frame-1" },
    });

    expect(document).toContain('src="/runtime.js"');
    expect(document).toContain("onerror=");
    expect(document).toContain("runtime-failed");
  });

  it("embeds the assets so a sandbox that cannot fetch them still renders", () => {
    const document = buildSiteFrameDocument({
      ...options,
      inlineAssets: { runtime: "window.ran = true;", stylesheet: "body { color: red; }" },
    });

    expect(document).toContain("<script>window.ran = true;</script>");
    expect(document).toContain("body { color: red; }");
    expect(document).not.toContain('src="/runtime.js"');
  });

  it("does not let embedded assets end their own tag early", () => {
    const document = buildSiteFrameDocument({
      ...options,
      inlineAssets: {
        runtime: 'const html = "</script><img src=x>";',
        stylesheet: "a::after { content: '</style>'; }",
      },
    });

    expect(document.match(/<\/script>/g)).toHaveLength(1);
    expect(document.match(/<\/style>/g)).toHaveLength(1);
  });
});
