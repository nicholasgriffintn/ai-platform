import { useEffect, useState } from "react";

import type { Theme } from "~/types";

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(
		() =>
			(typeof window !== "undefined"
				? (window.localStorage.getItem("theme") as Theme)
				: "system") || "system",
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		const effectiveTheme =
			theme === "system"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light"
				: theme;

		root.classList.add(effectiveTheme);
		if (theme === "system") {
			window.localStorage.removeItem("theme");
		} else {
			window.localStorage.setItem("theme", theme);
		}
	}, [theme]);

	return [theme, setTheme] as const;
}
