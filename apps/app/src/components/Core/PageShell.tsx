import {
  NotificationBar,
  PageShellContent,
  PageShellFrame,
  PageShellHeader,
  PageShellHeaderActions,
  PageShellHeaderContext,
  PageTitle,
  usePageShellHeaderRegistry,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { useResponsiveSidebar } from "~/hooks/useResponsiveSidebar";
import { SidebarLayout } from "~/layouts/SidebarLayout";

interface PageShellProps {
  title?: string;
  sidebarContent?: ReactNode;
  children: ReactNode;
  className?: string;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  fullBleed?: boolean;
  isBeta?: boolean;
  displayNavBar?: boolean;
  bgClassName?: string;
}

function PageShellRoot({
  title,
  sidebarContent,
  children,
  className,
  headerContent,
  headerActions,
  fullBleed = false,
  isBeta = false,
  displayNavBar,
  bgClassName,
}: PageShellProps) {
  useResponsiveSidebar();
  const { headerContext, registeredHeader } = usePageShellHeaderRegistry();

  const effectiveTitle = registeredHeader?.title ?? title;
  const effectiveActions = registeredHeader ? (
    <PageShellHeaderActions {...registeredHeader} />
  ) : (
    headerActions
  );

  const header =
    headerContent ||
    (effectiveTitle && (
      <ProductModeHeader
        showSidebarToggle={Boolean(sidebarContent)}
        context={
          <div className="min-w-0">
            <PageTitle
              title={effectiveTitle}
              className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200"
            />
          </div>
        }
        actions={effectiveActions}
      />
    ));

  return (
    <PageShellHeaderContext.Provider value={headerContext}>
      <SidebarLayout
        sidebarContent={sidebarContent}
        displayNavBar={displayNavBar ?? !header}
        bgClassName={bgClassName}
      >
        <PageShellFrame
          className={className}
          fullBleed={fullBleed}
          header={header}
          notification={
            isBeta ? (
              <NotificationBar
                title="Beta Feature"
                description="Dynamic Apps is currently in beta. Some features may change, not work or be unavailable."
              />
            ) : null
          }
        >
          {children}
        </PageShellFrame>
      </SidebarLayout>
    </PageShellHeaderContext.Provider>
  );
}

export const PageShell = Object.assign(PageShellRoot, {
  Content: PageShellContent,
  Header: PageShellHeader,
});
