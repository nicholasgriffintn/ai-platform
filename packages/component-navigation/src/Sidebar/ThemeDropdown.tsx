import { DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";

export type ThemePreference = "light" | "dark" | "system";

export interface ThemeOption {
	value: ThemePreference;
	icon: ComponentType<{ className?: string }>;
	label: string;
}

export const themeOptions: ThemeOption[] = [
	{ value: "system", icon: Monitor, label: "System" },
	{ value: "light", icon: Sun, label: "Light" },
	{ value: "dark", icon: Moon, label: "Dark" },
];

export interface ThemeDropdownProps {
	position?: "top" | "bottom";
	/** Undefined until the host has resolved the stored preference, which keeps SSR output stable. */
	theme?: ThemePreference;
	onThemeChange: (theme: ThemePreference) => void;
}

export function ThemeDropdown({ position = "bottom", theme, onThemeChange }: ThemeDropdownProps) {
	if (!theme) {
		return (
			<div className="flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200">
				<Monitor className="h-4 w-4" />
				<span className="sr-only">Theme</span>
			</div>
		);
	}

	const currentTheme = themeOptions.find((option) => option.value === theme) || themeOptions[0];
	const CurrentIcon = currentTheme.icon;

	return (
		<DropdownMenu
			position={position}
			menuClassName="w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5"
			trigger={
				<div className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
					<CurrentIcon className="h-4 w-4" />
					<span className="sr-only">Change theme</span>
				</div>
			}
		>
			{themeOptions.map((option) => {
				const OptionIcon = option.icon;
				return (
					<DropdownMenuItem
						key={option.value}
						onClick={() => onThemeChange(option.value)}
						icon={<OptionIcon className="h-4 w-4" />}
					>
						{option.label}
					</DropdownMenuItem>
				);
			})}
		</DropdownMenu>
	);
}
