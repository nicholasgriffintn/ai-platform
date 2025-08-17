import { Clock } from "lucide-react";
import { Link } from "react-router";

import { getIcon } from "~/components/Apps/utils";
import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import { Card } from "~/components/ui";
import { useDynamicAppResponses, useDynamicApps } from "~/hooks/useDynamicApps";
import { formatRelativeTime } from "~/lib/dates";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved Dynamic App Responses - Polychat" },
    {
      name: "description",
      content: "View your saved dynamic app responses",
    },
  ];
}

export default function DynamicAppResponsesPage() {
  const { data: responses, isLoading, error } = useDynamicAppResponses();

  const { data: apps } = useDynamicApps();
  const appMap = new Map(apps?.map((a) => [a.id, a]) ?? []);

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps" label="Back to Apps" />
          <PageTitle title="Saved Dynamic App Responses" />
        </PageHeader>
      }
      isBeta={true}
    >
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
        </div>
      ) : error ? (
        <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold mb-2">Failed to load responses</h3>
          <p>{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      ) : (responses?.length ?? 0) === 0 ? (
        <EmptyState
          title="No saved responses"
          message="Run a dynamic app and the result will be saved here for later."
          className="min-h-[400px]"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {responses!.map((resp) => {
            const app = appMap.get(resp.app_id);
            const icon = app ? getIcon(app.icon) : null;
            return (
              <Link
                key={resp.id}
                to={`/apps/responses/${resp.id}`}
                className="block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl"
              >
                <Card
                  className={cn(
                    "p-5 h-full flex flex-col gap-4",
                    "hover:shadow-lg transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {icon && <span className="text-2xl">{icon}</span>}
                    <span className="font-medium">
                      {app ? app.name : resp.app_id}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 gap-1">
                    <Clock size={14} />
                    <span>{formatRelativeTime(resp.created_at)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
