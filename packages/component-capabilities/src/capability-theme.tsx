import type { AppTheme, CapabilityCatalogItem as AppListItem } from "@ngriffin_uk/polychat-schemas";
import {
  AppWindow,
  Binary,
  BookOpen,
  BrainCircuit,
  Braces,
  Camera,
  Clapperboard,
  Cloud,
  CloudSun,
  Code2,
  File,
  FileSearch,
  FileText,
  FolderOpen,
  GraduationCap,
  Hammer,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Mic,
  Music,
  NotebookPen,
  Pencil,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
  Video,
  Wand2,
  Newspaper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";

type ThemeStyle = {
  iconColor: string;
  badgeClass: string;
  gradientClass: string;
  iconContainerClass: string;
};

type ThemeKey = AppTheme | "default";

const THEME_STYLES: Record<ThemeKey, ThemeStyle> = {
  violet: {
    iconColor: "text-accent-violet",
    badgeClass: "bg-accent-violet/15 text-accent-violet",
    gradientClass: "from-accent-violet/10 to-transparent",
    iconContainerClass: "bg-accent-violet/12",
  },
  indigo: {
    iconColor: "text-accent-indigo",
    badgeClass: "bg-accent-indigo/15 text-accent-indigo",
    gradientClass: "from-accent-indigo/10 to-transparent",
    iconContainerClass: "bg-accent-indigo/12",
  },
  pink: {
    iconColor: "text-accent-pink",
    badgeClass: "bg-accent-pink/15 text-accent-pink",
    gradientClass: "from-accent-pink/10 to-transparent",
    iconContainerClass: "bg-accent-pink/12",
  },
  rose: {
    iconColor: "text-accent-rose",
    badgeClass: "bg-accent-rose/15 text-accent-rose",
    gradientClass: "from-accent-rose/10 to-transparent",
    iconContainerClass: "bg-accent-rose/12",
  },
  cyan: {
    iconColor: "text-accent-cyan",
    badgeClass: "bg-accent-cyan/15 text-accent-cyan",
    gradientClass: "from-accent-cyan/10 to-transparent",
    iconContainerClass: "bg-accent-cyan/12",
  },
  emerald: {
    iconColor: "text-accent-emerald",
    badgeClass: "bg-accent-emerald/15 text-accent-emerald",
    gradientClass: "from-accent-emerald/10 to-transparent",
    iconContainerClass: "bg-accent-emerald/12",
  },
  amber: {
    iconColor: "text-accent-amber",
    badgeClass: "bg-accent-amber/15 text-accent-amber",
    gradientClass: "from-accent-amber/10 to-transparent",
    iconContainerClass: "bg-accent-amber/12",
  },
  sky: {
    iconColor: "text-accent-sky",
    badgeClass: "bg-accent-sky/15 text-accent-sky",
    gradientClass: "from-accent-sky/10 to-transparent",
    iconContainerClass: "bg-accent-sky/12",
  },
  slate: {
    iconColor: "text-accent-slate",
    badgeClass: "bg-accent-slate/15 text-accent-slate",
    gradientClass: "from-accent-slate/10 to-transparent",
    iconContainerClass: "bg-accent-slate/12",
  },
  blue: {
    iconColor: "text-accent-blue",
    badgeClass: "bg-accent-blue/15 text-accent-blue",
    gradientClass: "from-accent-blue/10 to-transparent",
    iconContainerClass: "bg-accent-blue/12",
  },
  default: {
    iconColor: "text-muted-foreground",
    badgeClass: "bg-selection text-foreground",
    gradientClass: "from-surface-elevated to-transparent",
    iconContainerClass: "bg-selection",
  },
};

const DEFAULT_THEME: ThemeKey = "default";

const ICON_MAP: Record<string, LucideIcon> = {
  app: AppWindow,
  "apply-edit-completion": Wand2,
  "add-reasoning-step": BrainCircuit,
  binary: Binary,
  "book-open": BookOpen,
  "brain-circuit": BrainCircuit,
  braces: Braces,
  camera: Camera,
  capture: Camera,
  "capture-screenshot": Camera,
  "chat-bubble": MessageSquare,
  clapperboard: Clapperboard,
  cloud: Cloud,
  "cloud-sun": CloudSun,
  "code-2": Code2,
  document: FileText,
  file: File,
  "file-search": FileSearch,
  "file-text": FileText,
  "folder-open": FolderOpen,
  "graduation-cap": GraduationCap,
  image: ImageIcon,
  mail: Mail,
  mic: Mic,
  music: Music,
  newspaper: Newspaper,
  note: NotebookPen,
  "notebook-pen": NotebookPen,
  "next-edit-completion": Code2,
  pencil: Pencil,
  "plus-circle": PlusCircle,
  research: BookOpen,
  search: Search,
  sparkles: Sparkles,
  speech: Mic,
  tutor: GraduationCap,
  users: Users,
  "user-cog": UserCog,
  "users-round": UsersRound,
  video: Video,
  "wand-2": Wand2,
  "web-search": Search,
  "fill-in-middle-completion": Braces,
  "create-image": ImageIcon,
  "create-video": Video,
  "create-music": Music,
  "create-speech": Mic,
  create: Sparkles,
  "extract-content": FileSearch,
  "get-weather": Cloud,
  "document-text": FileText,
  hammer: Hammer,
};

const normaliseIconName = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.replace(/_/g, "-").toLowerCase();
};

export const getThemeStyle = (theme?: string): ThemeStyle => {
  const key = (theme as ThemeKey) || DEFAULT_THEME;

  return THEME_STYLES[key] || THEME_STYLES.default;
};

export const getIcon = (
  iconName?: string,
  theme?: string,
  sizeClassName = "h-10 w-10",
): React.ReactNode => {
  const IconComponent = ICON_MAP[normaliseIconName(iconName) ?? ""];
  const { iconColor } = getThemeStyle(theme);

  const iconProps = {
    className: `${sizeClassName} ${iconColor}`,
    strokeWidth: 1.5,
  };

  if (IconComponent) {
    return React.createElement(IconComponent, iconProps);
  }

  return React.createElement(Settings, iconProps);
};

export const getBadgeClass = (theme?: string): string => {
  return getThemeStyle(theme).badgeClass;
};

export const getCardGradient = (theme?: string): string => {
  return getThemeStyle(theme).gradientClass;
};

export const getIconContainerClass = (theme?: string): string => {
  return getThemeStyle(theme).iconContainerClass;
};

export const sortAppsByName = (apps: AppListItem[]): AppListItem[] => {
  return [...apps].sort((a, b) => a.name.localeCompare(b.name));
};

export const groupAppsByCategory = (apps: AppListItem[]): [string, AppListItem[]][] => {
  const featuredApps = sortAppsByName(apps.filter((app) => app.featured));
  const nonFeaturedApps = apps.filter((app) => !app.featured);

  const featuredGroup: [string, AppListItem[]][] =
    featuredApps.length > 0 ? [["Featured", featuredApps]] : [];

  const grouped: Record<string, AppListItem[]> = {};

  for (const app of nonFeaturedApps) {
    const category = app.category || "Other";

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(app);
  }

  const categoryPriority: Record<string, number> = {
    "Agents & Delegation": 1,
    "Research & Retrieval": 2,
    "Content Generation": 3,
    "Code Assistance": 4,
    "Productivity & Coaching": 5,
    "Data & Utilities": 6,
    Other: 999,
  };

  const sortedCategoryEntries = Object.entries(grouped)
    .map<[string, AppListItem[]]>(([category, categoryApps]) => [
      category,
      sortAppsByName(categoryApps),
    ])
    .sort((a, b) => {
      const priorityA = categoryPriority[a[0]] || 500;
      const priorityB = categoryPriority[b[0]] || 500;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a[0].localeCompare(b[0]);
    });

  return [...featuredGroup, ...sortedCategoryEntries];
};
