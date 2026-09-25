import type {
  LinkComponent,
  LinkRenderProps,
  NavLinkComponent,
  NavLinkRenderProps,
} from "@ngriffin_uk/polychat-utility-react";
import { forwardRef } from "react";
import { Link, NavLink } from "react-router";

export const RouterLink: LinkComponent = forwardRef<HTMLAnchorElement, LinkRenderProps>(
  function RouterLink({ href, children, ...props }, ref) {
    return (
      <Link ref={ref} to={href} {...props}>
        {children}
      </Link>
    );
  },
);

export const RouterNavLink: NavLinkComponent = forwardRef<HTMLAnchorElement, NavLinkRenderProps>(
  function RouterNavLink({ href, ...props }, ref) {
    return <NavLink ref={ref} to={href} {...props} />;
  },
);
