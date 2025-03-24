import { useEffect } from "react";

import { ConversationThread } from "~/components/ConversationThread";
import { SearchDialog } from "~/components/SearchDialog";
import { AppLayout } from "~/layouts/AppLayout";
import { useChatStore } from "~/state/stores/chatStore";

export default function Home() {
  const {
    initializeStore,
    setSidebarVisible,
    setIsMobile,
    showSearch,
    setShowSearch,
  } = useChatStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to initialize the store when the component mounts
  useEffect(() => {
    const init = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const completionId = searchParams.get("completion_id");
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

  return (
    <AppLayout isChat={true}>
      <div className="flex flex-row flex-grow flex-1 overflow-hidden relative h-full">
        <div className="flex flex-col flex-grow h-full w-[calc(100%-16rem)]">
          <div className="flex-1 overflow-hidden relative">
            <ConversationThread />
          </div>
        </div>
      </div>

      <SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </AppLayout>
  );
}
