import { useEffect, useState } from "react";

/**
 * Server-rendered markup cannot see stored preferences, so surfaces that read them wait for the
 * first client render before showing the resolved value.
 */
export function useIsHydrated(): boolean {
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	return isHydrated;
}
