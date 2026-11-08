import type { ViewportPreview } from "./render";
import type { StoredPreviewScreenshot } from "./screenshots";

const OVERFLOW_TOLERANCE_PX = 4;

function listProblems(previews: readonly ViewportPreview[]): string[] {
  const problems = new Map<string, string[]>();
  const note = (problem: string, viewport: string) =>
    problems.set(problem, [...(problems.get(problem) ?? []), viewport]);

  for (const preview of previews) {
    if (preview.status !== "rendered") {
      continue;
    }

    const { report, viewport } = preview;

    for (const error of report.errors) {
      note(`page error: ${error.message}${error.source ? ` (${error.source})` : ""}`, viewport);
    }

    for (const entry of report.console) {
      note(`console ${entry.level}: ${entry.message}`, viewport);
    }

    for (const request of report.requests) {
      note(`request ${request.reason}: ${request.url}`, viewport);
    }

    if (report.contentWidth > report.viewportWidth + OVERFLOW_TOLERANCE_PX) {
      note(
        `content is ${report.contentWidth}px wide in a ${report.viewportWidth}px viewport, so it scrolls sideways`,
        viewport,
      );
    }
  }

  return [...problems].map(([problem, viewports]) => `- [${viewports.join(", ")}] ${problem}`);
}

function describeViewport(preview: ViewportPreview): string {
  if (preview.status !== "rendered") {
    return `${preview.viewport}: not rendered. ${preview.reason}`;
  }

  return `${preview.viewport}: rendered at ${preview.report.viewportWidth}px wide; content is ${preview.report.contentWidth}×${preview.report.contentHeight}px.`;
}

export function summarisePreview(
  previews: readonly ViewportPreview[],
  screenshots: readonly StoredPreviewScreenshot[] | null,
): { text: string; next: string } {
  const rendered = previews.some((preview) => preview.status === "rendered");
  const screenshotsAttached = screenshots?.some(({ status }) => status === "attached") ?? false;
  const problems = listProblems(previews);
  const lines = [
    "Preview of the draft under the artifact sandbox rules.",
    ...previews.map(describeViewport),
  ];

  if (problems.length > 0) {
    lines.push("Problems:", ...problems);
  } else if (rendered) {
    lines.push("No console errors, page errors, blocked requests or sideways scrolling.");
  }

  if (rendered && screenshots === null) {
    lines.push("Screenshots are not attached because the current model cannot read images.");
  }

  for (const screenshot of screenshots ?? []) {
    if (screenshot.status === "omitted") {
      lines.push(`The ${screenshot.viewport} screenshot is not attached: ${screenshot.reason}.`);
    }
  }

  return {
    text: lines.join("\n"),
    next: !rendered
      ? "Present the artifact without a preview; do not retry."
      : problems.length > 0
        ? "Fix these problems, then present the artifact. Preview again only if the fix changes the layout."
        : `${screenshotsAttached ? "Check the screenshots for layout problems, then present" : "Present"} the artifact.`,
  };
}
