import {
  Cloud,
  FileText,
  Image,
  Mail,
  MessageSquare,
  Mic,
  Music,
  Search,
  Settings,
  Video,
} from "lucide-react";
import React from "react";
import type { AppListItem } from "~/lib/api/dynamic-apps";

export const getIconColor = (iconName?: string): string => {
  switch (iconName) {
    case "chat-bubble":
      return "text-blue-500 dark:text-blue-400";
    case "mail":
      return "text-purple-500 dark:text-purple-400";
    case "image":
      return "text-pink-500 dark:text-pink-400";
    case "video":
      return "text-red-500 dark:text-red-400";
    case "music":
      return "text-indigo-500 dark:text-indigo-400";
    case "speech":
      return "text-green-500 dark:text-green-400";
    case "document":
      return "text-amber-500 dark:text-amber-400";
    case "search":
      return "text-cyan-500 dark:text-cyan-400";
    case "cloud":
      return "text-sky-500 dark:text-sky-400";
    default:
      return "text-zinc-600 dark:text-zinc-300";
  }
};

export const getIcon = (iconName?: string): React.ReactNode => {
  const iconProps = {
    className: `h-10 w-10 ${getIconColor(iconName)}`,
    strokeWidth: 1.5,
  };

  switch (iconName) {
    case "chat-bubble":
      return React.createElement(MessageSquare, iconProps);
    case "mail":
      return React.createElement(Mail, iconProps);
    case "image":
      return React.createElement(Image, iconProps);
    case "video":
      return React.createElement(Video, iconProps);
    case "music":
      return React.createElement(Music, iconProps);
    case "speech":
      return React.createElement(Mic, iconProps);
    case "document":
      return React.createElement(FileText, iconProps);
    case "search":
      return React.createElement(Search, iconProps);
    case "cloud":
      return React.createElement(Cloud, iconProps);
    default:
      return React.createElement(Settings, iconProps);
  }
};

export const getCategoryColor = (category?: string): string => {
  switch (category) {
    case "Functions":
      return "bg-amber-100 text-amber-800 dark:bg-amber-800/20 dark:text-amber-300";
    default:
      return "bg-off-white-highlight text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200";
  }
};

export const getCardGradient = (iconName?: string): string => {
  switch (iconName) {
    case "chat-bubble":
      return "from-blue-50 to-white dark:from-blue-900/10 dark:to-zinc-800";
    case "mail":
      return "from-purple-50 to-white dark:from-purple-900/10 dark:to-zinc-800";
    case "image":
      return "from-pink-50 to-white dark:from-pink-900/10 dark:to-zinc-800";
    case "video":
      return "from-red-50 to-white dark:from-red-900/10 dark:to-zinc-800";
    case "music":
      return "from-indigo-50 to-white dark:from-indigo-900/10 dark:to-zinc-800";
    case "speech":
      return "from-green-50 to-white dark:from-green-900/10 dark:to-zinc-800";
    case "document":
      return "from-amber-50 to-white dark:from-amber-900/10 dark:to-zinc-800";
    case "search":
      return "from-cyan-50 to-white dark:from-cyan-900/10 dark:to-zinc-800";
    case "cloud":
      return "from-sky-50 to-white dark:from-sky-900/10 dark:to-zinc-800";
    default:
      return "from-zinc-50 to-white dark:from-zinc-700/20 dark:to-zinc-800";
  }
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
    Functions: 1,
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

export const styles = {
  container: "container mx-auto px-4 py-8 max-w-7xl",
  card: "border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
  cardWithGradient: (iconName?: string) =>
    `border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-gradient-to-br ${getCardGradient(iconName)} hover:border-zinc-300 dark:hover:border-zinc-600`,
  heading: "text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50",
  subheading:
    "text-xl font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-2",
  paragraph: "text-zinc-600 dark:text-zinc-300",
  smallText: "text-sm text-zinc-500 dark:text-zinc-400",
  primaryButton:
    "px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors",
  secondaryButton:
    "px-4 py-2 bg-off-white-highlight dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md transition-colors",
  iconContainer: "p-3 rounded-lg bg-off-white dark:bg-zinc-700 shadow-sm",
  badge: (category?: string) =>
    `inline-block px-3 py-1 text-xs rounded-full ${getCategoryColor(category)}`,
  getIconColor,
  getIcon,
};
