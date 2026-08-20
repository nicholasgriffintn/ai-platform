import {
  AlertTriangle,
  Bot,
  Braces,
  Cloud,
  FileText,
  FolderOpen,
  Globe,
  Image,
  Lightbulb,
  Music,
  Notebook,
  PlusCircle,
  QrCode,
  Search,
  Sparkles,
  Terminal,
  Video,
  Volume2,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

/**
 * Keys are the icon names the API assigns in `getFunctionIcon`, plus the lucide names a tool or
 * connector may declare directly. Unknown keys fall back to the generic tool glyph rather than
 * disappearing.
 */
const TOOL_ICONS: Record<string, IconComponent> = {
  "alert-triangle": AlertTriangle,
  app: Wrench,
  bot: Bot,
  braces: Braces,
  cloud: Cloud,
  "file-text": FileText,
  "folder-open": FolderOpen,
  globe: Globe,
  image: Image,
  lightbulb: Lightbulb,
  music: Music,
  note: Notebook,
  "plus-circle": PlusCircle,
  qr: QrCode,
  "qr-code": QrCode,
  search: Search,
  sparkles: Sparkles,
  speech: Volume2,
  terminal: Terminal,
  video: Video,
  wrench: Wrench,
};

export const resolveToolIcon = (icon?: string): IconComponent => {
  if (!icon) {
    return Wrench;
  }

  return TOOL_ICONS[icon.toLowerCase()] ?? Wrench;
};

export const ToolIcon = ({
  icon,
  size = 16,
  className,
}: {
  icon?: string;
  size?: number;
  className?: string;
}) => {
  const Icon = resolveToolIcon(icon);

  return <Icon size={size} className={className} />;
};
