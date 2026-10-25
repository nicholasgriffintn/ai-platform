import { ArtifactWorkbenchPanel } from "@ngriffin_uk/polychat-component-content";
import { useOverlayDismiss } from "@ngriffin_uk/polychat-component-ui";
import { useArtifactWorkbench } from "@ngriffin_uk/polychat-library-react";

export function ConversationArtifactOverlay() {
  const artifact = useArtifactWorkbench();
  const isOpen = artifact.isPanelVisible && artifact.currentArtifact !== null;
  const overlayRef = useOverlayDismiss<HTMLElement>({
    open: isOpen,
    onClose: artifact.closePanel,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      ref={overlayRef}
      aria-label="Artifact"
      tabIndex={-1}
      className="polychat-motion-enter absolute inset-0 z-20 bg-surface"
    >
      <ArtifactWorkbenchPanel
        artifact={artifact.currentArtifact}
        artifacts={artifact.currentArtifacts}
        isCombined={artifact.isCombinedPanel}
        copied={artifact.copied}
        onCopy={artifact.copyArtifact}
        onClose={artifact.closePanel}
      />
    </aside>
  );
}
