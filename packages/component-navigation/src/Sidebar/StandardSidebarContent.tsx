import { SidebarShell, type SidebarPeekPointerHandlers } from "@ngriffin_uk/polychat-component-ui";
import { Home } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarNavLink, SidebarNavSection } from "./SidebarNav";

export interface StandardSidebarContentProps {
  children?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  homeHref: string;
  isMobile: boolean;
  sidebarVisible: boolean;
  peeking?: boolean;
  peekProps?: SidebarPeekPointerHandlers;
  onClose: () => void;
}

export function StandardSidebarContent({
  children,
  footer,
  header,
  homeHref,
  isMobile,
  sidebarVisible,
  peeking,
  peekProps,
  onClose,
}: StandardSidebarContentProps) {
  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      peeking={peeking}
      peekProps={peekProps}
      onClose={onClose}
      header={header}
      footer={footer}
    >
      <nav aria-label="Primary" className="space-y-4 px-2 pb-[50px]">
        <SidebarNavSection>
          <SidebarNavLink href={homeHref} end icon={<Home size={16} />}>
            Back to Home
          </SidebarNavLink>
        </SidebarNavSection>
        {children}
      </nav>
    </SidebarShell>
  );
}
