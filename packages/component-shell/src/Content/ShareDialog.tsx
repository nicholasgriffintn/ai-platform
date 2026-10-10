import {
  ShareDialog as ControlledShareDialog,
  type ShareDialogLabels,
  type ShareableContentType,
} from "@ngriffin_uk/polychat-component-content";
import type { ButtonCollapse } from "@ngriffin_uk/polychat-component-ui";
import { capitaliseFirst } from "@ngriffin_uk/polychat-utility-core";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareDialogProps {
  type: ShareableContentType;
  itemId: string;
  isPublic?: boolean;
  shareId?: string;
  onShare: (itemId: string) => Promise<{ share_id: string }>;
  onUnshare: (itemId: string) => Promise<void>;
  allowUpdate?: boolean;
  getShareUrl: (shareId: string) => string;
  collapseLabel?: ButtonCollapse;
  className?: string;
  labels?: ShareDialogLabels;
}

export function ShareDialog({
  type,
  itemId,
  isPublic = false,
  shareId,
  onShare,
  onUnshare,
  allowUpdate = false,
  getShareUrl,
  collapseLabel = false,
  className,
  labels,
}: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentShareId, setCurrentShareId] = useState(shareId);
  const [currentIsPublic, setCurrentIsPublic] = useState(isPublic);
  const [prevShareId, setPrevShareId] = useState(shareId);
  const [prevIsPublic, setPrevIsPublic] = useState(isPublic);
  const { copied, copy } = useCopyToClipboard();

  if (prevShareId !== shareId || prevIsPublic !== isPublic) {
    setPrevShareId(shareId);
    setPrevIsPublic(isPublic);
    setCurrentShareId(shareId);
    setCurrentIsPublic(isPublic);
  }

  const share = async () => {
    try {
      setIsSharing(true);
      const result = await onShare(itemId);

      setCurrentShareId(result.share_id);
      setCurrentIsPublic(true);
      toast.success(`${labelFor(type)} shared successfully`);
    } catch {
      toast.error(`Failed to share ${type}`);
    } finally {
      setIsSharing(false);
    }
  };

  const update = async () => {
    try {
      setIsUpdating(true);
      const result = await onShare(itemId);

      setCurrentShareId(result.share_id);
      toast.success("Link updated to include everything so far");
    } catch {
      toast.error("Failed to update the link");
    } finally {
      setIsUpdating(false);
    }
  };

  const unshare = async () => {
    try {
      setIsUnsharing(true);
      await onUnshare(itemId);
      setCurrentShareId(undefined);
      setCurrentIsPublic(false);
      toast.success(`${labelFor(type)} unshared`);
    } catch {
      toast.error(`Failed to unshare ${type}`);
    } finally {
      setIsUnsharing(false);
    }
  };

  return (
    <ControlledShareDialog
      type={type}
      isOpen={isOpen}
      isPublic={currentIsPublic}
      shareUrl={currentShareId ? getShareUrl(currentShareId) : undefined}
      isSharing={isSharing}
      isUnsharing={isUnsharing}
      isUpdating={isUpdating}
      copied={copied}
      collapseLabel={collapseLabel}
      className={className}
      labels={labels}
      onOpenChange={setIsOpen}
      onShare={() => void share()}
      onUnshare={() => void unshare()}
      onUpdate={allowUpdate ? () => void update() : undefined}
      onCopy={copy}
    />
  );
}

function labelFor(value: string): string {
  return capitaliseFirst(value);
}
