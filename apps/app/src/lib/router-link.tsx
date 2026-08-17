import type {
	LinkComponent,
	NavLinkComponent,
	NavLinkRenderProps,
} from "@ngriffin_uk/polychat-component-ui";
import { forwardRef } from "react";
import { Link, NavLink } from "react-router";

/**
 * Render packages emit resolved hrefs; these adapters turn them into client-side router links so
 * shared components never import a router themselves.
 */
export const RouterLink: LinkComponent = forwardRef<HTMLAnchorElement, { href: string }>(
	function RouterLink({ href, ...props }, ref) {
		return <Link ref={ref} to={href} {...props} />;
	},
);

export const RouterNavLink: NavLinkComponent = forwardRef<HTMLAnchorElement, NavLinkRenderProps>(
	function RouterNavLink({ href, ...props }, ref) {
		return <NavLink ref={ref} to={href} {...props} />;
	},
);
