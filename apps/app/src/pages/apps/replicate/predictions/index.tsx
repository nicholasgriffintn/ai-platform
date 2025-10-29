import type { FC } from "react";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import { ReplicatePredictions } from "~/components/Replicate/ReplicatePredictions";

export function meta() {
  return [
    { title: "My Predictions - Polychat" },
    { name: "description", content: "View your Replicate model predictions" },
  ];
}

const ReplicatePredictionsRoute: FC = () => {
  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps/replicate" label="Back to Models" />
          <PageTitle title="My Predictions" />
        </PageHeader>
      }
      isBeta={true}
    >
      <ReplicatePredictions />
    </PageShell>
  );
};

export default ReplicatePredictionsRoute;
