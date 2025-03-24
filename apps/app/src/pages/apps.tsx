import type { FC } from "react";

import { DynamicApps } from "~/components/Apps";
import { AppLayout } from "~/layouts/AppLayout";

const DynamicAppsRoute: FC = () => {
  return (
    <AppLayout>
      <div
        className="bg-off-white-highlight dark:bg-zinc-800/80 border-l-4 border-blue-500 text-zinc-700 dark:text-zinc-200 p-4 mb-6"
        role="alert"
        aria-labelledby="beta-alert-title"
        aria-describedby="beta-alert-description"
      >
        <p
          id="beta-alert-title"
          className="font-bold text-zinc-800 dark:text-zinc-100"
        >
          Beta Feature
        </p>
        <p id="beta-alert-description">
          Dynamic Apps is currently in beta. Some features may change, not work
          or be unavailable.
        </p>
      </div>
      <DynamicApps />
    </AppLayout>
  );
};

export default DynamicAppsRoute;
