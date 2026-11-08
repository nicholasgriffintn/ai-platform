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
