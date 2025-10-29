import type { FC } from "react";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import { ReplicateModels } from "~/components/Replicate/ReplicateModels";

export function meta() {
  return [
    { title: "Replicate Models - Polychat" },
    {
      name: "description",
      content:
        "Generate images, videos, audio, and more with Replicate AI models",
    },
  ];
}

const ReplicateModelsRoute: FC = () => {
  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps" label="Back to Apps" />
          <PageTitle title="Replicate Models" />
        </PageHeader>
      }
      isBeta={true}
    >
      <ReplicateModels />
    </PageShell>
  );
};

export default ReplicateModelsRoute;
