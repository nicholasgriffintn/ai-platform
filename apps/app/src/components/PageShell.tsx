import type { ReactNode } from "react";
import { NotificationBar } from "~/components/NotificationBar";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { cn } from "~/lib/utils";

interface PageShellProps {
  title?: string;
  sidebarContent?: ReactNode;
  children: ReactNode;
  className?: string;
  headerContent?: ReactNode;
  fullBleed?: boolean;
  isBeta?: boolean;
}

export function PageShell({
  title,
  sidebarContent,
  children,
  className,
  headerContent,
  fullBleed = false,
  isBeta = false,
}: PageShellProps) {
  const header =
    headerContent ||
    (title && (
      <PageHeader>
        <PageTitle title={title} />
      </PageHeader>
    ));

  if (sidebarContent) {
    return (
      <SidebarLayout sidebarContent={sidebarContent}>
        {isBeta && (
          <NotificationBar
            title="Beta Feature"
            description="Dynamic Apps is currently in beta. Some features may change, not work or be unavailable."
          />
        )}
        {fullBleed ? (
          <>
            {header}
            {children}
          </>
        ) : (
          <div
            className={cn(
              "container mx-auto px-4 py-8 overflow-y-auto",
              className,
            )}
          >
            {header}
            {children}
          </div>
        )}
      </SidebarLayout>
    );
  }

  return (
    <>
      {header}
      {children}
    </>
  );
}
