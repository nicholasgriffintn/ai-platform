import { ShareTeammateModal } from "@ngriffin_uk/polychat-component-account";

import { useTeammateSharing } from "~/hooks/useSharedTeammates";

interface ShareTeammateDialogProps {
  agent: { id: string; name: string; description?: string | null } | null;
  onClose: () => void;
}

export function ShareTeammateDialog({ agent, onClose }: ShareTeammateDialogProps) {
  const sharing = useTeammateSharing(agent?.id ?? null);

  return (
    <ShareTeammateModal
      agent={agent}
      categories={sharing.categories}
      error={sharing.listingError}
      isLoadingListing={sharing.isLoadingListing}
      isSharing={sharing.isSharing}
      isUnsharing={sharing.isUnsharing}
      listing={sharing.listing}
      onClose={onClose}
      onShare={(data) => sharing.shareTeammate(data)}
      onUnshare={async (sharedTeammateId) => {
        await sharing.unshareTeammate(sharedTeammateId);
        onClose();
      }}
      open={agent !== null}
    />
  );
}
