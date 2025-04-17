import { useEffect } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { ConversationThread } from "~/components/ConversationThread";
import { SearchDialog } from "~/components/SearchDialog";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { useChatStore } from "~/state/stores/chatStore";

export default function Home() {
  const {
    initializeStore,
    setSidebarVisible,
    setIsMobile,
    showSearch,
    setShowSearch,
    setChatInput,
  } = useChatStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to initialize the store when the component mounts
  useEffect(() => {
    const init = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const completionId = searchParams.get("completion_id");
      const query = searchParams.get("query");

      if (query) {
        setChatInput(query);
      }

      await initializeStore(completionId || undefined);
    };

    init();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      setIsMobile(isMobile);
      setSidebarVisible(!isMobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [setSidebarVisible, setIsMobile]);

  const chatSidebar = <ChatSidebar />;

  return (
    <SidebarLayout sidebarContent={chatSidebar}>
      <div className="flex flex-row flex-grow flex-1 overflow-hidden relative h-full">
        <div className="flex flex-col flex-grow h-full w-full">
          <div className="flex-1 overflow-hidden relative">
            <h1 className="sr-only">Conversation</h1>
            <ConversationThread />
          </div>
        </div>
      </div>

      <SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </SidebarLayout>
  );
}
