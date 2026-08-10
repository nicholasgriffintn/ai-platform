import { Cloud, CloudOff, Menu, PanelLeftOpen } from "lucide-react";

import { Button } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { ProductModeSwitch } from "./ProductModeSwitch";

export function ProductModeHeader({ showCloudToggle = false }: { showCloudToggle?: boolean }) {
	const { trackEvent } = useTrackEvent();
	const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();
	const { isAuthenticated, localOnlyMode, setLocalOnlyMode } = useChatStore();

	const toggleLocalOnlyMode = () => {
		const nextMode = !localOnlyMode;
		setLocalOnlyMode(nextMode);
		window.localStorage.setItem("localOnlyMode", String(nextMode));
		trackEvent({
			name: "toggle_local_only_mode",
			category: "header",
			label: "toggle_local_only_mode",
			value: nextMode ? "local-only" : "cloud",
		});
	};

	return (
		<header className="grid h-[53px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2">
			<div className="justify-self-start">
				{!sidebarVisible && (
					<Button
						type="button"
						variant="icon"
						title="Show sidebar"
						aria-label="Show sidebar"
						icon={isMobile ? <Menu size={20} /> : <PanelLeftOpen size={20} />}
						onClick={() => setSidebarVisible(true)}
					/>
				)}
			</div>
			<ProductModeSwitch className="w-44 justify-self-center" />
			<div className="justify-self-end">
				{showCloudToggle && isAuthenticated && (
					<Button
						type="button"
						variant={localOnlyMode ? "iconActive" : "icon"}
						title={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
						aria-label={localOnlyMode ? "Switch to cloud mode" : "Switch to local-only mode"}
						icon={localOnlyMode ? <CloudOff size={20} /> : <Cloud size={20} />}
						onClick={toggleLocalOnlyMode}
					/>
				)}
			</div>
		</header>
	);
}
