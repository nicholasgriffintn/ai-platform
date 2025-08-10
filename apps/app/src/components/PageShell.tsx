import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { NotificationBar } from "~/components/NotificationBar";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";

interface PageShellProps {
  title?: string;
  sidebarContent?: ReactNode;
  children: ReactNode;
  className?: string;
  headerContent?: ReactNode;
  fullBleed?: boolean;
  isBeta?: boolean;
  displayNavBar?: boolean;
  bgClassName?: string;
}

export function PageShell({
  title,
  sidebarContent,
  children,
  className,
  headerContent,
  fullBleed = false,
  isBeta = false,
  displayNavBar = true,
  bgClassName,
}: PageShellProps) {
  const { setSidebarVisible, setIsMobile, setIsMobileLoading } = useUIStore();

  const checkMobile = useCallback(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    setIsMobile(isMobile);
    setSidebarVisible(!isMobile);
    setIsMobileLoading(false);
  }, [setSidebarVisible, setIsMobile, setIsMobileLoading]);

  useEffect(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [checkMobile]);

  const header =
    headerContent ||
    (title && (
      <PageHeader>
        <PageTitle title={title} />
      </PageHeader>
    ));

  return (
    <SidebarLayout
      sidebarContent={sidebarContent}
      displayNavBar={displayNavBar}
      bgClassName={bgClassName}
    >
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
