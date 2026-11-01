import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { StandardSidebarContent } from "../Sidebar/StandardSidebarContent.js";
import { AdminTaskDetail } from "./Tasks/AdminTaskDetail.js";
import { AdminTasksOverview } from "./Tasks/AdminTasksOverview.js";

function AdminSection({ subpath }: { subpath: string }) {
  const [section, taskId] = subpath.split("/").filter(Boolean);

  if (section === "tasks" && taskId) {
    return <AdminTaskDetail taskId={decodeURIComponent(taskId)} />;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="polychat-eyebrow">Admin</p>
        <h1 className="font-display text-3xl text-foreground">Background work</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every account's tasks, each running as its own workflow. Refreshed every ten seconds, so
          there is no need to keep poking it.
        </p>
      </header>
      <AdminTasksOverview />
    </div>
  );
}

export function AdminApp({ subpath }: { subpath: string }) {
  const { isAuthenticated, isLoading, user } = useAuthStatus();

  return (
    <PageShell
      title="Admin"
      headerTitleAs="span"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      {isLoading ? (
        <PageStatus message="Checking your credentials..." />
      ) : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to see admin"
          message="Admin pages are for the people who keep Polychat running."
        />
      ) : user?.role !== "admin" ? (
        <PageStatus message="This perch is for administrators." />
      ) : (
        <AdminSection subpath={subpath} />
      )}
    </PageShell>
  );
}
