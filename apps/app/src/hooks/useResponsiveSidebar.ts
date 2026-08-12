import { useEffect } from "react";

import { useUIStore } from "~/state/stores/uiStore";

const mobileMediaQuery = "(max-width: 768px)";

export function useResponsiveSidebar() {
	const setIsMobile = useUIStore((state) => state.setIsMobile);
	const setIsMobileLoading = useUIStore((state) => state.setIsMobileLoading);
	const setSidebarVisible = useUIStore((state) => state.setSidebarVisible);

	useEffect(() => {
		const mediaQuery = window.matchMedia(mobileMediaQuery);
		const updateResponsiveState = (isMobile: boolean) => {
			const previousIsMobile = useUIStore.getState().isMobile;

			if (isMobile !== previousIsMobile) {
				setIsMobile(isMobile);
				setSidebarVisible(!isMobile);
			}
			setIsMobileLoading(false);
		};
		const handleBreakpointChange = (event: MediaQueryListEvent) => {
			updateResponsiveState(event.matches);
		};

		updateResponsiveState(mediaQuery.matches);
		mediaQuery.addEventListener("change", handleBreakpointChange);

		return () => mediaQuery.removeEventListener("change", handleBreakpointChange);
	}, [setIsMobile, setIsMobileLoading, setSidebarVisible]);
}
