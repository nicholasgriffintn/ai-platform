import type {
  LinkComponent,
  LinkComponents,
  LinkRenderProps,
  NavLinkComponent,
  NavLinkRenderProps,
} from "@ngriffin_uk/polychat-utility-react";
import { createContext, type ReactNode, forwardRef, useContext, useMemo } from "react";

export type {
  LinkComponent,
  LinkComponents,
  LinkRenderProps,
  NavLinkComponent,
  NavLinkRenderProps,
  NavLinkState,
} from "@ngriffin_uk/polychat-utility-react";

const AnchorLink: LinkComponent = forwardRef<HTMLAnchorElement, LinkRenderProps>(
  function AnchorLink(props, ref) {
    return <a ref={ref} {...props} />;
  },
);

/** Without a host router there is no route to compare against, so nothing is ever active. */
const AnchorNavLink: NavLinkComponent = forwardRef<HTMLAnchorElement, NavLinkRenderProps>(
  function AnchorNavLink({ className, end: _end, ...props }, ref) {
    const resolvedClassName =
      typeof className === "function" ? className({ isActive: false }) : className;

    return <a ref={ref} className={resolvedClassName} {...props} />;
  },
);

const defaultLinkComponents: LinkComponents = { Link: AnchorLink, NavLink: AnchorNavLink };

const LinkComponentsContext = createContext<LinkComponents>(defaultLinkComponents);

export interface LinkProviderProps extends Partial<LinkComponents> {
  children: ReactNode;
}

export function LinkProvider({ children, Link: link, NavLink: navLink }: LinkProviderProps) {
  const components = useMemo<LinkComponents>(
    () => ({
      Link: link ?? defaultLinkComponents.Link,
      NavLink: navLink ?? defaultLinkComponents.NavLink,
    }),
    [link, navLink],
  );

  return (
    <LinkComponentsContext.Provider value={components}>{children}</LinkComponentsContext.Provider>
  );
}

export function useLinkComponents(): LinkComponents {
  return useContext(LinkComponentsContext);
}

export const Link = forwardRef<HTMLAnchorElement, LinkRenderProps>(function Link(props, ref) {
  const { Link: Component } = useLinkComponents();

  return <Component ref={ref} {...props} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkRenderProps>(
  function NavLink(props, ref) {
    const { NavLink: Component } = useLinkComponents();

    return <Component ref={ref} {...props} />;
  },
);
