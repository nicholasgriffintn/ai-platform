import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { lazy, Suspense } from "react";

const MetaAssistantOverlay = lazy(() =>
  import("../MetaAssistant/MetaAssistantOverlay.js").then((module) => ({
    default: module.MetaAssistantOverlay,
  })),
);

const NewProjectConversationDialog = lazy(() =>
  import("../Work/NewProjectConversationDialog.js").then((module) => ({
    default: module.NewProjectConversationDialog,
  })),
);

export function ShellDialogs() {
  const { showMetaAssistant, setShowMetaAssistant, showProjectPicker, setShowProjectPicker } =
    useUIStore();

  return (
    <>
      {showMetaAssistant && (
        <Suspense fallback={null}>
          <MetaAssistantOverlay open onClose={() => setShowMetaAssistant(false)} />
        </Suspense>
      )}
      {showProjectPicker && (
        <Suspense fallback={null}>
          <NewProjectConversationDialog open onOpenChange={setShowProjectPicker} />
        </Suspense>
      )}
    </>
  );
}
