import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { withProjectFunding } from "~/modules/usage/application/workspace-funding";

export async function withSourceFunding<T>(
  context: ServiceContext,
  sourceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const source = await context.repositories.get(SourceRepository).getSource(sourceId);

  return withProjectFunding(context.repositories, { projectId: source?.project_id }, fn);
}
