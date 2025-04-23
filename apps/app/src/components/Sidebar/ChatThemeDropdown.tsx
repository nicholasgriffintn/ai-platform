import { Monitor, Moon, Sun } from "lucide-react";
import { type JSX, useEffect, useState } from "react";

import { DropdownMenu, DropdownMenuItem } from "~/components/ui";
import { useTheme } from "~/hooks/useTheme";
import type { Theme } from "~/types";

interface ThemeOption {
  value: Theme;
  icon: ({ className }: { className: string }) => JSX.Element;
  text: string;
}

export const ChatThemeDropdown = ({
  position = "bottom",
}: { position?: "top" | "bottom" } = {}) => {
  const [theme, setTheme] = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themeOptions: ThemeOption[] = [
    {
      value: "system",
      icon: ({ className }: { className: string }) => (
        <Monitor className={className} />
      ),
      text: "System",
    },
    {
      value: "light",
      icon: ({ className }: { className: string }) => (
        <Sun className={className} />
      ),
      text: "Light",
    },
    {
      value: "dark",
      icon: ({ className }: { className: string }) => (
        <Moon className={className} />
      ),
      text: "Dark",
    },
  ];

  const handleThemeChange = (newTheme: Theme) => {
    if (typeof setTheme === "function") {
      setTheme(newTheme);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200">
        <Monitor className="h-4 w-4" />
        <span className="sr-only">Theme</span>
      </div>
    );
  }

  const currentTheme =
    themeOptions.find((option) => option.value === theme) || themeOptions[0];

  return (
    <DropdownMenu
      position={position}
      menuClassName="w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5"
      trigger={
        <div className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
          <currentTheme.icon className="h-4 w-4" />
          <span className="sr-only">Change theme</span>
        </div>
      }
    >
      {themeOptions.map((option, index) => (
        <DropdownMenuItem
          key={`${option.value}-${index}`}
          onClick={() => handleThemeChange(option.value)}
          icon={<option.icon className="h-4 w-4" />}
        >
          {option.text}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
};
