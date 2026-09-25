import type { LineageEdge } from "@ngriffin_uk/polychat-schemas";

export function collectAncestry(edges: readonly LineageEdge[], versionId: string): LineageEdge[] {
  const byTarget = new Map<string, LineageEdge[]>();

  for (const edge of edges) {
    byTarget.set(edge.toVersionId, [...(byTarget.get(edge.toVersionId) ?? []), edge]);
  }

  const collected: LineageEdge[] = [];
  const visited = new Set<string>([versionId]);
  const queue = [versionId];

  while (queue.length > 0) {
    const current = queue.shift();

    for (const edge of current ? (byTarget.get(current) ?? []) : []) {
      collected.push(edge);

      if (!visited.has(edge.fromVersionId)) {
        visited.add(edge.fromVersionId);
        queue.push(edge.fromVersionId);
      }
    }
  }

  return collected;
}
