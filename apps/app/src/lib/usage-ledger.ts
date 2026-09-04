import type {
  ProjectSummary,
  WorkspaceUsageSummaryResponse,
  UsageEventRecord,
  UsageEventsResponse,
} from "@ngriffin_uk/polychat-schemas";

export function getNextUsageEventsPageParam(lastPage: UsageEventsResponse): string | undefined {
  return lastPage.next_cursor ?? undefined;
}

export function flattenUsageEventPages(
  pages: UsageEventsResponse[] | undefined,
): UsageEventRecord[] {
  if (!pages) {
    return [];
  }

  const seen = new Set<string>();
  const events: UsageEventRecord[] = [];

  for (const page of pages) {
    for (const event of page.events) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        events.push(event);
      }
    }
  }

  return events;
}

export function workspaceProjectUsageRows(
  summary: WorkspaceUsageSummaryResponse,
  projects: ProjectSummary[],
) {
  const names = new Map(projects.map((project) => [project.id, project.name]));

  return summary.by_project.map((row) => ({
    ...row,
    label: row.key
      ? (names.get(row.key) ?? "Project no longer listed")
      : "Unassigned workspace usage",
  }));
}
