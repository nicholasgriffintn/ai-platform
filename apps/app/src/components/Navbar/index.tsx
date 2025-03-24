import {
  BarChart2,
  Grid,
  Menu,
  MoreVertical,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "~/components/ui";
import { APP_NAME } from "~/constants";
import { useChatStore } from "~/state/stores/chatStore";

interface ChatNavbarProps {
  showSidebarToggle?: boolean;
}

export const ChatNavbar = ({ showSidebarToggle = true }: ChatNavbarProps) => {
  const { isMobile, sidebarVisible, setSidebarVisible } = useChatStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderNavLinks = () => (
    <>
      <Link
        to="/apps"
        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-lg"
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Grid size={16} />
        <span>Apps</span>
      </Link>
      <a
        href="https://metrics.polychat.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-lg"
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <BarChart2 size={16} />
        <span>Metrics</span>
      </a>
    </>
  );

  return (
    <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 z-10 w-full">
      <div className="m-2 flex items-center justify-between max-w-full">
        <div className="flex items-center min-w-0">
          {showSidebarToggle && (
            <div className="flex-shrink-0">
              <Button
                type="button"
                variant="icon"
                onClick={() => setSidebarVisible(!sidebarVisible)}
                title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                icon={
                  isMobile ? <Menu size={20} /> : <PanelLeftOpen size={20} />
                }
              />
            </div>
          )}
          <h1 className="text-base font-semibold text-zinc-600 dark:text-zinc-200 ml-2 truncate">
            <Link
              to="/"
              className="hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline no-underline"
            >
              {APP_NAME}
            </Link>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="hidden md:flex md:items-center md:gap-2">
            {renderNavLinks()}
          </div>

          <div className="md:hidden relative" ref={mobileMenuRef}>
            <Button
              type="button"
              variant="icon"
              onClick={() =>
                isMounted && setIsMobileMenuOpen(!isMobileMenuOpen)
              }
              title={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              icon={
                isMobileMenuOpen ? <X size={16} /> : <MoreVertical size={16} />
              }
            />

            {isMounted && isMobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5 z-20">
                <div className="py-1">{renderNavLinks()}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
