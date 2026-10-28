import type { ProjectTaskFixUp } from "@ngriffin_uk/polychat-schemas";

const FIX_UP_SOURCE_LABELS: Record<ProjectTaskFixUp["source"], string> = {
  review: "review",
  ci: "CI",
  pull_request_review: "pull request review",
};

export function renderFixUp(fixUp: ProjectTaskFixUp | undefined): string | null {
  if (!fixUp) {
    return null;
  }

  return [
    `Fix-up requested from ${fixUp.from} (${FIX_UP_SOURCE_LABELS[fixUp.source]}) at ${fixUp.at}:`,
    fixUp.note,
    "Address this before anything else, then say what you changed in your update.",
  ].join("\n");
}
