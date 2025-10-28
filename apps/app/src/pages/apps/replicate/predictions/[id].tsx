import type { FC } from "react";
import { useParams } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import { ReplicatePredictionDetail } from "~/components/Replicate/ReplicatePredictionDetail";

export function meta() {
  return [
    { title: "Prediction Details - Polychat" },
    { name: "description", content: "View Replicate prediction details" },
  ];
}

const ReplicatePredictionDetailRoute: FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-4xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink
            to="/apps/replicate/predictions"
            label="Back to Predictions"
          />
        </PageHeader>
      }
      isBeta={true}
    >
      <ReplicatePredictionDetail predictionId={id || ""} />
    </PageShell>
  );
};

export default ReplicatePredictionDetailRoute;
