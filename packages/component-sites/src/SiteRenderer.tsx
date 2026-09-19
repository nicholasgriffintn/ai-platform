import { isSiteComponentType } from "@ngriffin_uk/polychat-library-sites";
import type { SitePage } from "@ngriffin_uk/polychat-schemas";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { SITE_COMPONENT_REGISTRY } from "./registry.js";

class ElementBoundary extends Component<
  { elementKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`Site element "${this.props.elementKey}" failed to render`, error, info);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function renderElement(page: SitePage, key: string, trail: Set<string>): ReactNode {
  const element = page.elements[key];

  if (!element || trail.has(key) || !isSiteComponentType(element.type)) {
    return null;
  }

  const Renderer = SITE_COMPONENT_REGISTRY[element.type];
  const nextTrail = new Set(trail).add(key);
  const children = element.children
    .map((child) => renderElement(page, child, nextTrail))
    .filter((child) => child !== null);

  return (
    <ElementBoundary key={key} elementKey={key}>
      <Renderer {...element.props}>{children.length > 0 ? children : undefined}</Renderer>
    </ElementBoundary>
  );
}

export function SiteRenderer({ page }: { page: SitePage }) {
  return <>{renderElement(page, page.root, new Set())}</>;
}
