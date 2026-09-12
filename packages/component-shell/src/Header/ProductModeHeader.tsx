import { ProductHeaderShell, ProductModeSwitch } from "@ngriffin_uk/polychat-component-navigation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  getProductMode,
  isProductModeRoute,
  MODE_BASE_PATHS,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useHeaderScrollEdge } from "@ngriffin_uk/polychat-utility-react";
import { Menu, PanelLeftOpen } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useLocation } from "react-router";

export interface ProductModeHeaderProps {
  actions?: ReactNode;
  context?: ReactNode;
  projectColour?: string;
  showProductModeSwitch?: boolean;
  showSidebarToggle?: boolean;
}

export function ProductModeHeader({
  actions,
  context,
  projectColour,
  showProductModeSwitch,
  showSidebarToggle = true,
}: ProductModeHeaderProps) {
  const { pathname } = useLocation();
  const shouldShowProductModeSwitch = showProductModeSwitch ?? isProductModeRoute(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const isScrolled = useHeaderScrollEdge(headerRef, pathname);
  const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();

  return (
    <ProductHeaderShell
      headerRef={headerRef}
      isScrolled={isScrolled}
      start={
        <>
          {showSidebarToggle && !sidebarVisible && (
            <Button
              type="button"
              variant="icon"
              title="Show sidebar"
              aria-label="Show sidebar"
              icon={isMobile ? <Menu size={20} /> : <PanelLeftOpen size={20} />}
              onClick={() => setSidebarVisible(true)}
            />
          )}
          {projectColour ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: projectColour }}
            />
          ) : null}
          {context ? <div className="min-w-0 flex-1">{context}</div> : null}
        </>
      }
      center={
        shouldShowProductModeSwitch ? (
          <ProductModeSwitch
            activeMode={getProductMode(pathname)}
            className="w-auto shrink-0 @min-[40rem]:w-44"
            destinations={{ chat: MODE_BASE_PATHS.chat, work: MODE_BASE_PATHS.work }}
          />
        ) : null
      }
      end={actions}
    />
  );
}
