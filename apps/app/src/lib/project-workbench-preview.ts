import type { ProjectWorkbenchPreviewFeedback } from "@ngriffin_uk/polychat-component-workspaces";

function formatContextLine(value: string, maxLength: number): string {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}

function formatRegion(region: NonNullable<ProjectWorkbenchPreviewFeedback["region"]>): string {
  return [
    `x ${region.x.toFixed(1)}%`,
    `y ${region.y.toFixed(1)}%`,
    `width ${region.width.toFixed(1)}%`,
    `height ${region.height.toFixed(1)}%`,
  ].join(", ");
}

export function formatProjectWorkbenchPreviewFeedback(
  feedback: ProjectWorkbenchPreviewFeedback,
): string {
  const viewport = feedback.viewport.width
    ? `${feedback.viewport.label} (${feedback.viewport.width} × ${feedback.viewport.height})`
    : `${feedback.viewport.label} (current panel width × ${feedback.viewport.height})`;
  const context = [
    "Preview review feedback",
    `Service: ${formatContextLine(feedback.serviceName, 100)}`,
    `Route: ${formatContextLine(feedback.route, 500)}`,
    `Viewport: ${viewport}`,
    feedback.region ? `Region: ${formatRegion(feedback.region)}` : undefined,
    feedback.elementReference
      ? `Element: ${formatContextLine(feedback.elementReference, 160)}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return `${context.join("\n")}\n\nFeedback:\n${feedback.annotation.trim().slice(0, 1000)}`;
}
