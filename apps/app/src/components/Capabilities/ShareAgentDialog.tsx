import { ShareAgentModal } from "@ngriffin_uk/polychat-component-account";

import { useAgentSharing } from "~/hooks/useSharedAgents";

interface ShareAgentDialogProps {
  agent: { id: string; name: string; description?: string | null } | null;
  onClose: () => void;
}

export function ShareAgentDialog({ agent, onClose }: ShareAgentDialogProps) {
  const sharing = useAgentSharing(agent?.id ?? null);

  return (
    <ShareAgentModal
      agent={agent}
      categories={sharing.categories}
      error={sharing.listingError}
      isLoadingListing={sharing.isLoadingListing}
      isSharing={sharing.isSharing}
      isUnsharing={sharing.isUnsharing}
      listing={sharing.listing}
      onClose={onClose}
      onShare={(data) => sharing.shareAgent(data)}
      onUnshare={async (sharedAgentId) => {
        await sharing.unshareAgent(sharedAgentId);
        onClose();
      }}
      open={agent !== null}
    />
  );
}
