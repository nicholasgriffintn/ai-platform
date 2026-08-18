import { PageShell } from "~/components/Core/PageShell";
import { ResponsesExperience } from "~/components/Experiences/ResponsesExperience";

export function ProjectOutputs({
  workspaceId,
  projectId,
  subpath,
}: {
  workspaceId: string;
  projectId: string;
  subpath: string;
}) {
  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header title="Outputs" />
      <p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        Saved results created by this project’s capabilities.
      </p>
      <ResponsesExperience
        basePath={`/work/${workspaceId}/projects/${projectId}/outputs`}
        projectId={projectId}
        subpath={subpath}
      />
    </PageShell.Content>
  );
}
