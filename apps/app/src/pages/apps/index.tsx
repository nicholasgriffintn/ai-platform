import type { FC } from "react";

import { DynamicApps } from "~/components/Apps";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Apps - Polychat" },
    { name: "description", content: "Apps for Polychat" },
  ];
}

const DynamicAppsRoute: FC = () => {
  return (
    <PageShell sidebarContent={<StandardSidebarContent />} isBeta={true}>
      <DynamicApps />
    </PageShell>
  );
};

export default DynamicAppsRoute;
