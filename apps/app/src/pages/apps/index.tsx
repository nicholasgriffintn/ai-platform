import type { FC } from "react";
import { useNavigate } from "react-router";

import { DynamicApps } from "~/components/Apps";
import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button } from "~/components/ui";

export function meta() {
  return [
    { title: "Apps - Polychat" },
    { name: "description", content: "Apps for Polychat" },
  ];
}

const DynamicAppsRoute: FC = () => {
  const navigate = useNavigate();
  return (
    <PageShell sidebarContent={<StandardSidebarContent />} isBeta={true}>
      <div className="flex justify-end mb-4">
        <Button variant="primary" onClick={() => navigate("/apps/video-notes")}>Video Notes</Button>
      </div>
      <DynamicApps />
    </PageShell>
  );
};

export default DynamicAppsRoute;
