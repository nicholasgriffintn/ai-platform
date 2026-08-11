import type { ReactNode } from "react";
import { Cloud, CloudOff, Menu, PanelLeftOpen } from "lucide-react";

import { Button } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { ProductModeSwitch } from "./ProductModeSwitch";

interface ProductModeHeaderProps {
	actions?: ReactNode;
	context?: ReactNode;
	showCloudToggle?: boolean;
}

export function ProductModeHeader({
	actions,
	context,
	showCloudToggle = false,
}: ProductModeHeaderProps) {
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
		<header className="flex h-[53px] shrink-0 items-center gap-1 px-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
			<div className="flex min-w-0 flex-1 items-center gap-1 sm:justify-self-stretch sm:gap-2">
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
				{context ? <div className="min-w-0 flex-1">{context}</div> : null}
			</div>
			<ProductModeSwitch className="w-auto shrink-0 sm:w-44 sm:justify-self-center" />
			<div className="flex min-w-0 shrink-0 items-center sm:justify-self-end">
				{actions}
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
