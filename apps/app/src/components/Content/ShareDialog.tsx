import {
  ShareDialog as ControlledShareDialog,
  type ShareDialogLabels,
  type ShareableContentType,
} from "@ngriffin_uk/polychat-component-content";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";

interface ShareDialogProps {
  type: ShareableContentType;
  itemId: string;
  isPublic?: boolean;
  shareId?: string;
  onShare: (itemId: string) => Promise<{ share_id: string }>;
  onUnshare: (itemId: string) => Promise<void>;
  getShareUrl: (shareId: string) => string;
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
  getShareUrl,
  className,
  labels,
}: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [currentShareId, setCurrentShareId] = useState(shareId);
  const [currentIsPublic, setCurrentIsPublic] = useState(isPublic);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    setCurrentShareId(shareId);
    setCurrentIsPublic(isPublic);
  }, [isPublic, shareId]);

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
      copied={copied}
      className={className}
      labels={labels}
      onOpenChange={setIsOpen}
      onShare={share}
      onUnshare={unshare}
      onCopy={copy}
    />
  );
}

function labelFor(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
