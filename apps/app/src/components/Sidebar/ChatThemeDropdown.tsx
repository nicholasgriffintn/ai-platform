import { ThemeDropdown } from "@ngriffin_uk/polychat-component-navigation";

import { useIsHydrated } from "~/hooks/useIsHydrated";
import { useTheme } from "~/hooks/useTheme";

export const ChatThemeDropdown = ({
	position = "bottom",
}: {
	position?: "top" | "bottom";
} = {}) => {
	const [theme, setTheme] = useTheme();
	const isHydrated = useIsHydrated();

	return (
		<ThemeDropdown
			position={position}
			theme={isHydrated ? theme : undefined}
			onThemeChange={setTheme}
		/>
	);
};
