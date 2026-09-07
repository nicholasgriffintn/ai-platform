import { ShareTeammateModal } from "@ngriffin_uk/polychat-component-account";
import { useTeammateSharing } from "@ngriffin_uk/polychat-library-react";

interface ShareTeammateDialogProps {
  teammate: { id: string; name: string; description?: string | null } | null;
  onClose: () => void;
}

export function ShareTeammateDialog({ teammate, onClose }: ShareTeammateDialogProps) {
  const sharing = useTeammateSharing(teammate?.id ?? null);

  return (
    <ShareTeammateModal
      teammate={teammate}
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
      open={teammate !== null}
    />
  );
}
