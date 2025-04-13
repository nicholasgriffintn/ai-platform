import { useState } from "react";
import { Link } from "react-router";
import { useChatStore } from "~/state/stores/chatStore";
import { LoginModal } from "./LoginModal";
import { SidebarFooter } from "./Sidebar/SidebarFooter";
import { SidebarHeader } from "./Sidebar/SidebarHeader";

export function StandardSidebarContent() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const handleOpenLoginModal = () => setIsLoginModalOpen(true);
  const { sidebarVisible, isMobile, setSidebarVisible } = useChatStore();

  return (
    <>
      {sidebarVisible && isMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setSidebarVisible(false)}
          onKeyDown={(e) => e.key === "Enter" && setSidebarVisible(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed md:relative z-50 h-full w-64 bg-off-white dark:bg-zinc-900 transition-transform duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 ${sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"}`}
      >
        {sidebarVisible && (
          <div className="flex flex-col h-full w-64 overflow-hidden">
            <SidebarHeader showCloudButton={false} />
            <nav className="flex-1 overflow-y-auto p-2 pb-[50px]">
              <ul className="space-y-1">
                <li>
                  <Link
                    to="/"
                    className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 no-underline"
                  >
                    Home
                  </Link>
                </li>
              </ul>
            </nav>
            <SidebarFooter
              onOpenLoginModal={handleOpenLoginModal}
              enableClearAllMessages={false}
            />
          </div>
        )}
      </div>
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onKeySubmit={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
