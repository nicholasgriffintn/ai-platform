import { ProductModeSwitch as ControlledProductModeSwitch } from "@ngriffin_uk/polychat-component-navigation";
import { NavLink, useLocation } from "react-router";

export function ProductModeSwitch({ className }: { className?: string }) {
	const { pathname } = useLocation();
	return (
		<ControlledProductModeSwitch
			activeMode={pathname.startsWith("/work") ? "work" : "chat"}
			className={className}
			onSelect={() => undefined}
			renderControl={({ active, className: controlClassName, icon, label, mode }) => (
				<NavLink
					to={mode === "chat" ? "/chat" : "/work"}
					aria-label={label}
					aria-current={active ? "page" : undefined}
					className={`${controlClassName} no-underline`}
				>
					{icon}
					<span className="polychat-navigation-mode-label">{label}</span>
				</NavLink>
			)}
		/>
	);
}
