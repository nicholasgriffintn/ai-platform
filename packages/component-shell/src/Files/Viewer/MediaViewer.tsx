import { Viewer } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { MediaFileTarget } from "@ngriffin_uk/polychat-library-react";
import { Download, Image as ImageIcon, Info } from "lucide-react";
import { useState } from "react";

import { MediaCheckPanel } from "./MediaCheckPanel.js";

export function MediaViewer({ target, onClose }: { target: MediaFileTarget; onClose: () => void }) {
  const [showInfo, setShowInfo] = useState(false);
  const downloadHref = target.downloadHref ?? target.url;

  return (
    <Viewer
      title={target.title}
      icon={<ImageIcon size={14} aria-hidden="true" />}
      onClose={onClose}
      stage={
        <figure className="flex h-full items-center justify-center p-6">
          <img
            src={target.url}
            alt={target.title}
            crossOrigin={target.crossOrigin}
            decoding="async"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </figure>
      }
      actions={
        <>
          <Button
            variant="icon"
            size="sm"
            icon={<Download size={15} />}
            aria-label="Download"
            title="Download"
            onClick={() => window.open(downloadHref, "_blank", "noopener,noreferrer")}
          />
          <Button
            variant={showInfo ? "iconActive" : "icon"}
            size="sm"
            icon={<Info size={15} />}
            aria-label="File info"
            title="File info"
            onClick={() => setShowInfo((current) => !current)}
          />
        </>
      }
      side={
        showInfo
          ? {
              title: "File info",
              onClose: () => setShowInfo(false),
              content: <MediaCheckPanel url={target.url} />,
            }
          : null
      }
    />
  );
}
