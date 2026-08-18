import { useParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { SourcesLibrary } from "~/components/Profile/Tabs/ProfileSourcesTab";

export default function ProjectSourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return projectId ? (
    <PageShell.Content className="max-w-6xl">
      <SourcesLibrary projectId={projectId} title="Sources" />
    </PageShell.Content>
  ) : null;
}
