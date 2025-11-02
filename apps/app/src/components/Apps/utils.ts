import {
  Binary,
  BookOpen,
  BrainCircuit,
  Braces,
  Camera,
  Clapperboard,
  CloudSun,
  Code2,
  FileSearch,
  GraduationCap,
  Image as ImageIcon,
  Mic,
  Music,
  NotebookPen,
  Pencil,
  Search,
  Settings,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
  Wand2,
  Newspaper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";
import type { AppListItem, AppTheme } from "~/types/apps";

type ThemeStyle = {
  iconColor: string;
  badgeClass: string;
  gradientClass: string;
  iconContainerClass: string;
};

type ThemeKey = AppTheme | "default";

const THEME_STYLES: Record<ThemeKey, ThemeStyle> = {
  violet: {
    iconColor: "text-violet-500 dark:text-violet-400",
    badgeClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
    gradientClass:
      "from-violet-50 to-white dark:from-violet-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-violet-100/70 dark:bg-violet-900/20",
  },
  indigo: {
    iconColor: "text-indigo-500 dark:text-indigo-400",
    badgeClass:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    gradientClass:
      "from-indigo-50 to-white dark:from-indigo-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-indigo-100/70 dark:bg-indigo-900/20",
  },
  pink: {
    iconColor: "text-pink-500 dark:text-pink-400",
    badgeClass:
      "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200",
    gradientClass:
      "from-pink-50 to-white dark:from-pink-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-pink-100/70 dark:bg-pink-900/20",
  },
  rose: {
    iconColor: "text-rose-500 dark:text-rose-400",
    badgeClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    gradientClass:
      "from-rose-50 to-white dark:from-rose-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-rose-100/70 dark:bg-rose-900/20",
  },
  cyan: {
    iconColor: "text-cyan-500 dark:text-cyan-400",
    badgeClass:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
    gradientClass:
      "from-cyan-50 to-white dark:from-cyan-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-cyan-100/70 dark:bg-cyan-900/20",
  },
  emerald: {
    iconColor: "text-emerald-500 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    gradientClass:
      "from-emerald-50 to-white dark:from-emerald-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-emerald-100/70 dark:bg-emerald-900/20",
  },
  amber: {
    iconColor: "text-amber-500 dark:text-amber-400",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    gradientClass:
      "from-amber-50 to-white dark:from-amber-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-amber-100/70 dark:bg-amber-900/20",
  },
  sky: {
    iconColor: "text-sky-500 dark:text-sky-400",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    gradientClass: "from-sky-50 to-white dark:from-sky-900/10 dark:to-zinc-800",
    iconContainerClass: "bg-sky-100/70 dark:bg-sky-900/20",
  },
  slate: {
    iconColor: "text-slate-500 dark:text-slate-300",
    badgeClass:
      "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
    gradientClass:
      "from-slate-50 to-white dark:from-slate-800/20 dark:to-zinc-800",
    iconContainerClass: "bg-slate-100/70 dark:bg-slate-800/30",
  },
  default: {
    iconColor: "text-zinc-600 dark:text-zinc-300",
    badgeClass:
      "bg-off-white-highlight text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
    gradientClass:
      "from-zinc-50 to-white dark:from-zinc-700/20 dark:to-zinc-800",
    iconContainerClass: "bg-off-white dark:bg-zinc-700",
  },
};

const DEFAULT_THEME: ThemeKey = "slate";

const ICON_MAP: Record<string, LucideIcon> = {
  "brain-circuit": BrainCircuit,
  users: Users,
  "user-cog": UserCog,
  "users-round": UsersRound,
  "file-search": FileSearch,
  newspaper: Newspaper,
  search: Search,
  "book-open": BookOpen,
  "cloud-sun": CloudSun,
  camera: Camera,
  image: ImageIcon,
  clapperboard: Clapperboard,
  music: Music,
  mic: Mic,
  braces: Braces,
  "code-2": Code2,
  "wand-2": Wand2,
  binary: Binary,
  sparkles: Sparkles,
  "graduation-cap": GraduationCap,
  pencil: Pencil,
  "notebook-pen": NotebookPen,
};

const normaliseIconName = (value?: string): string | undefined => {
  if (!value) return undefined;
  return value.replace(/_/g, "-").toLowerCase();
};

export const getThemeStyle = (theme?: string): ThemeStyle => {
  const key = (theme as ThemeKey) || DEFAULT_THEME;
  return THEME_STYLES[key] || THEME_STYLES.default;
};

export const getIcon = (iconName?: string, theme?: string): React.ReactNode => {
  const IconComponent = ICON_MAP[normaliseIconName(iconName) ?? ""];
  const { iconColor } = getThemeStyle(theme);

  const iconProps = {
    className: `h-10 w-10 ${iconColor}`,
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

export const groupAppsByCategory = (
  apps: AppListItem[],
): [string, AppListItem[]][] => {
  const sorted = sortAppsByName(apps);

  const grouped: Record<string, AppListItem[]> = {};

  for (const app of sorted) {
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

  return Object.entries(grouped).sort((a, b) => {
    const priorityA = categoryPriority[a[0]] || 500;
    const priorityB = categoryPriority[b[0]] || 500;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a[0].localeCompare(b[0]);
  });
};
