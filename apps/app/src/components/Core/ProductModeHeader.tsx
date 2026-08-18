import { ProductHeaderShell, ProductModeSwitch } from "@ngriffin_uk/polychat-component-navigation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useHeaderScrollEdge } from "@ngriffin_uk/polychat-utility-react";
import { Cloud, CloudOff, Menu, PanelLeftOpen } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useLocation } from "react-router";

import { useTrackEvent } from "~/hooks/use-track-event";
import { isProductModeRoute } from "~/lib/navigation/product-mode";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

interface ProductModeHeaderProps {
  actions?: ReactNode;
  context?: ReactNode;
  showCloudToggle?: boolean;
  showSidebarToggle?: boolean;
}

export function ProductModeHeader({
  actions,
  context,
  showCloudToggle = false,
  showSidebarToggle = true,
}: ProductModeHeaderProps) {
  const { pathname } = useLocation();
  const showProductModeSwitch = isProductModeRoute(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const isScrolled = useHeaderScrollEdge(headerRef, pathname);
  const { trackEvent } = useTrackEvent();
  const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();
  const { isAuthenticated, localOnlyMode, setLocalOnlyMode } = useChatStore();

  const toggleLocalOnlyMode = () => {
    const nextMode = !localOnlyMode;

    setLocalOnlyMode(nextMode);
    trackEvent({
      name: "toggle_local_only_mode",
      category: "header",
      label: "toggle_local_only_mode",
      value: nextMode ? "local-only" : "cloud",
    });
  };

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
          {context ? <div className="min-w-0 flex-1">{context}</div> : null}
        </>
      }
      center={
        showProductModeSwitch ? (
          <ProductModeSwitch
            activeMode={pathname.startsWith("/work") ? "work" : "chat"}
            className="w-auto shrink-0 sm:w-44 sm:justify-self-center"
            destinations={{ chat: "/chat", work: "/work" }}
          />
        ) : null
      }
      end={
        <>
          {actions}
          {showCloudToggle && isAuthenticated && (
            <Button
              type="button"
              variant={localOnlyMode ? "iconActive" : "icon"}
              title={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
              aria-label={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
              icon={localOnlyMode ? <CloudOff size={20} /> : <Cloud size={20} />}
              onClick={toggleLocalOnlyMode}
            />
          )}
        </>
      }
    />
  );
}
