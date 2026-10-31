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

import { ProductModeHeader } from "../Header/ProductModeHeader.js";
import { ProductShell, useInsideProductShell } from "./ProductShell.js";

export interface PageShellProps {
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
  projectColour?: string;
  headerTitleAs?: "h1" | "span";
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
  projectColour,
  headerTitleAs = "h1",
}: PageShellProps) {
  const { headerContext, registeredHeader } = usePageShellHeaderRegistry();
  const insideProductShell = useInsideProductShell();

  const effectiveTitle = registeredHeader?.title ?? title;
  const effectiveActions = registeredHeader ? (
    <PageShellHeaderActions {...registeredHeader} />
  ) : (
    headerActions
  );

  const productModeHeader = effectiveTitle ? (
    <ProductModeHeader
      showSidebarToggle={Boolean(sidebarContent)}
      projectColour={projectColour}
      context={
        <div className="min-w-0">
          <PageTitle
            title={effectiveTitle}
            as={headerTitleAs}
            className="truncate text-sm font-medium text-foreground"
          />
        </div>
      }
      actions={effectiveActions}
      bordered={registeredHeader?.bordered}
    />
  ) : null;

  const header = registeredHeader ? productModeHeader : headerContent || productModeHeader;

  const frame = (
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
  );

  return (
    <PageShellHeaderContext.Provider value={headerContext}>
      {insideProductShell ? (
        frame
      ) : (
        <ProductShell
          sidebarContent={sidebarContent}
          displayNavBar={displayNavBar ?? !header}
          bgClassName={bgClassName}
        >
          {frame}
        </ProductShell>
      )}
    </PageShellHeaderContext.Provider>
  );
}

export const PageShell = Object.assign(PageShellRoot, {
  Content: PageShellContent,
  Header: PageShellHeader,
});
