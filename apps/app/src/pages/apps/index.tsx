import type { FC } from "react";

import { DynamicApps } from "~/components/Apps";
import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";

export function meta() {
  return [
    { title: "Apps - Polychat" },
    { name: "description", content: "Apps for Polychat" },
  ];
}

const DynamicAppsRoute: FC = () => {
  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="px-4 py-8"
      isBeta={true}
    >
      <DynamicApps />
    </PageShell>
  );
};

export default DynamicAppsRoute;
