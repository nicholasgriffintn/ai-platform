import { describe, expect, it } from "vitest";

import { buildPreviewDocument, readPreviewReport, type PreviewReport } from "../capture";
import type { ViewportPreview } from "../render";
import { summarisePreview } from "../summary";

const REPORT_ID = "polychat-preview-test";

function serialisedPage(value: unknown, id = REPORT_ID): string {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");

  return `<html><head></head><body><p>Hi</p></body><script type="application/json" id="${id}">${json}</script></html>`;
}

function report(overrides: Partial<PreviewReport> = {}): PreviewReport {
  return {
    console: [],
    errors: [],
    requests: [],
    contentHeight: 900,
    contentWidth: 1280,
    viewportWidth: 1280,
    ...overrides,
  };
}

function rendered(viewport: "desktop" | "mobile", value: PreviewReport): ViewportPreview {
  return { viewport, status: "rendered", screenshot: "data:image/png;base64,AA==", report: value };
}

describe("buildPreviewDocument", () => {
  it("runs the capture script under the artifact policy before any draft markup", () => {
    const document = buildPreviewDocument({
      html: "<script>boot()</script>",
      css: "body { color: red }",
      reportId: REPORT_ID,
    });
    const policy = document.indexOf('http-equiv="Content-Security-Policy"');
    const capture = document.indexOf(JSON.stringify(REPORT_ID));

    expect(policy).toBeGreaterThan(-1);
    expect(capture).toBeGreaterThan(policy);
    expect(capture).toBeLessThan(document.indexOf("body { color: red }"));
    expect(capture).toBeLessThan(document.indexOf("<script>boot()</script>"));
  });
});

describe("readPreviewReport", () => {
  it("reads the report the capture script left in the serialised page", () => {
    const value = report({
      console: [{ level: "error", message: "Bad </script> value" }],
      errors: [{ message: "TypeError: x is not a function", source: "about:srcdoc:4:12" }],
      requests: [
        { url: "https://example.com/a.png", reason: "blocked by the artifact sandbox (img-src)" },
      ],
    });

    expect(readPreviewReport(serialisedPage(value), REPORT_ID)).toEqual(value);
  });

  it("returns nothing when the page navigated away or the report is not ours", () => {
    expect(readPreviewReport("<html><body>Elsewhere</body></html>", REPORT_ID)).toBeNull();
    expect(
      readPreviewReport(serialisedPage(report(), "polychat-preview-other"), REPORT_ID),
    ).toBeNull();
    expect(readPreviewReport(serialisedPage({ console: "nope" }), REPORT_ID)).toBeNull();
  });

  it("caps entries and message length so a noisy page cannot flood the model", () => {
    const parsed = readPreviewReport(
      serialisedPage(
        report({
          console: Array.from({ length: 50 }, () => ({
            level: "warn" as const,
            message: "x".repeat(5_000),
          })),
        }),
      ),
      REPORT_ID,
    );

    expect(parsed?.console).toHaveLength(20);
    expect(parsed?.console[0]?.message).toHaveLength(600);
  });
});

describe("summarisePreview", () => {
  it("lists each problem once with the viewports it appeared in", () => {
    const error = { message: "ReferenceError: chart is not defined" };
    const summary = summarisePreview(
      [
        rendered("desktop", report({ errors: [error] })),
        rendered(
          "mobile",
          report({
            errors: [error],
            console: [{ level: "warn", message: "Deprecated API" }],
            requests: [
              {
                url: "https://cdn.example.com/x.js",
                reason: "blocked by the artifact sandbox (script-src-elem)",
              },
            ],
            contentWidth: 640,
            viewportWidth: 390,
          }),
        ),
      ],
      true,
    );

    expect(summary).toContain(
      "- [desktop, mobile] page error: ReferenceError: chart is not defined",
    );
    expect(summary).toContain("- [mobile] console warn: Deprecated API");
    expect(summary).toContain(
      "- [mobile] request blocked by the artifact sandbox (script-src-elem): https://cdn.example.com/x.js",
    );
    expect(summary).toContain("- [mobile] content is 640px wide in a 390px viewport");
    expect(summary).toContain("Next: fix these problems, then present the artifact.");
  });

  it("tells the model to present a clean draft and to check screenshots only when attached", () => {
    const previews = [rendered("desktop", report())];

    expect(summarisePreview(previews, true)).toContain(
      "Next: check the screenshots for layout problems, then present the artifact.",
    );
    expect(summarisePreview(previews, false)).toContain(
      "Screenshots are not attached because the current model cannot read images.",
    );
    expect(summarisePreview(previews, false)).toContain("Next: present the artifact.");
  });

  it("tells the model not to retry when no viewport rendered", () => {
    const summary = summarisePreview(
      [
        {
          viewport: "desktop",
          status: "unavailable",
          reason: "Browser rendering is not configured",
        },
      ],
      true,
    );

    expect(summary).toContain("desktop: not rendered. Browser rendering is not configured");
    expect(summary).toContain("Next: present the artifact without a preview; do not retry.");
  });
});
