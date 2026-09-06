import type { AnchorHTMLAttributes, ComponentType, ReactNode, Ref } from "react";

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
  end?: boolean;
  className?: string | ((state: NavLinkState) => string);
  children?: ReactNode;
}

export type LinkComponent = ComponentType<LinkRenderProps & { ref?: Ref<HTMLAnchorElement> }>;

export type NavLinkComponent = ComponentType<NavLinkRenderProps & { ref?: Ref<HTMLAnchorElement> }>;

export interface LinkComponents {
  Link: LinkComponent;
  NavLink: NavLinkComponent;
}
