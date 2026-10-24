import { Button } from "@ngriffin_uk/polychat-component-ui";
import { X } from "lucide-react";

export function FileViewerCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="icon"
      size="sm"
      icon={<X size={16} />}
      aria-label="Close file"
      title="Close"
      onClick={onClose}
    />
  );
}
