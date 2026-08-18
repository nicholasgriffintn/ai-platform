import {
  type AnchorHTMLAttributes,
  type ComponentType,
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

/**
 * Render packages never construct host routes. They receive a resolved `href` and let the host
 * decide how navigation happens, so a desktop or mobile shell can supply its own router.
 */
export interface LinkRenderProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: ReactNode;
}

export interface NavLinkState {
  isActive: boolean;
}

export interface NavLinkRenderProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "className"
> {
  href: string;
  /** Only treat the link as active on an exact path match. */
  end?: boolean;
  className?: string | ((state: NavLinkState) => string);
  children?: ReactNode;
}

export type LinkComponent = ComponentType<LinkRenderProps & { ref?: React.Ref<HTMLAnchorElement> }>;
export type NavLinkComponent = ComponentType<
  NavLinkRenderProps & { ref?: React.Ref<HTMLAnchorElement> }
>;

export interface LinkComponents {
  Link: LinkComponent;
  NavLink: NavLinkComponent;
}

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
