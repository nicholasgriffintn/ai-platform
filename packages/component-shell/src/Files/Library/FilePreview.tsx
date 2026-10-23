import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  BookOpenText,
  Database,
  Film,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  type LucideIcon,
  Mic,
  Radio,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useState } from "react";

import type { FileItem, FileType } from "./file-items.js";

export const FILE_TYPE_ICONS: Record<FileType, LucideIcon> = {
  result: Sparkles,
  document: FileText,
  note: StickyNote,
  image: ImageIcon,
  audio: Mic,
  video: Film,
  podcast: Radio,
  link: Link2,
  connected: Database,
  memory: BookOpenText,
  folder: Folder,
};

export function FileTypeIcon({ type, size = 16 }: { type: FileType; size?: number }) {
  const Icon = FILE_TYPE_ICONS[type];

  return <Icon size={size} aria-hidden="true" />;
}

export function FilePreview({ item, variant }: { item: FileItem; variant: "card" | "thumbnail" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isCard = variant === "card";

  if (item.previewUrl && !imageFailed) {
    return (
      <img
        src={item.previewUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (isCard && item.excerpt) {
    return (
      <p className="line-clamp-6 h-full overflow-hidden p-4 text-xs leading-5 text-muted-foreground">
        {item.excerpt}
      </p>
    );
  }

  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center text-muted-foreground",
        isCard && "transition-transform duration-300 group-hover:scale-105",
      )}
    >
      <FileTypeIcon type={item.type} size={isCard ? 36 : 17} />
    </span>
  );
}
