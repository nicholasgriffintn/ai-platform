import {
  evaluateSiteVisibility,
  isSiteComponentType,
  repeatItemKey,
  resolveElementProps,
  resolveRepeatItems,
  siteElementStyleClasses,
  type SiteScope,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteElement, SitePage } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { Component, Fragment, useMemo, type ErrorInfo, type ReactNode } from "react";

import { SITE_COMPONENT_REGISTRY } from "./registry.js";
import { useSiteNavigation } from "./ui.js";
import { useSiteRuntime, type SiteRenderRuntime } from "./useSiteRuntime.js";

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

const CONTENTS_STYLE = { display: "contents" } as const;

const EVENT_HANDLER_PROPS = { press: "onPress", change: "onChange", submit: "onSubmit" } as const;

function buildElementProps(
  element: SiteElement,
  scope: SiteScope,
  runtime: SiteRenderRuntime,
): Record<string, unknown> {
  const { props, bindings } = resolveElementProps(element.props, scope);
  const handlers: Record<string, (payload?: unknown) => void> = {};

  const boundPath = Object.values(bindings)[0];

  if (boundPath) {
    handlers.onChange = (next) => runtime.setPath(boundPath, next);
  }

  for (const [event, binding] of Object.entries(element.on ?? {})) {
    if (event !== "press" && event !== "change" && event !== "submit") {
      continue;
    }

    const handlerName = EVENT_HANDLER_PROPS[event];
    const previous = handlers[handlerName];

    handlers[handlerName] = (payload) => {
      previous?.(payload);

      return runtime.dispatch(binding, {
        ...scope,
        form:
          event === "submit" && isRecord(payload)
            ? payload
            : event === "change"
              ? { value: payload }
              : scope.form,
      });
    };
  }

  return { ...props, ...handlers };
}

function renderElement(
  page: SitePage,
  key: string,
  scope: SiteScope,
  runtime: SiteRenderRuntime,
  trail: Set<string>,
): ReactNode {
  const element = page.elements[key];

  if (!element || trail.has(key) || !isSiteComponentType(element.type)) {
    return null;
  }

  const Renderer = SITE_COMPONENT_REGISTRY[element.type];
  const nextTrail = new Set(trail).add(key);
  const renderOnce = (itemScope: SiteScope, reactKey: string) => {
    if (!evaluateSiteVisibility(element.visible, itemScope)) {
      return null;
    }

    const children = element.children
      .map((child) => renderElement(page, child, itemScope, runtime, nextTrail))
      .filter((child) => child !== null);

    const content = (
      <ElementBoundary key={reactKey} elementKey={key}>
        <span style={CONTENTS_STYLE} data-site-key={key} data-site-type={element.type}>
          <Renderer {...buildElementProps(element, itemScope, runtime)}>
            {children.length > 0 ? children : undefined}
          </Renderer>
        </span>
      </ElementBoundary>
    );

    const styleClasses = siteElementStyleClasses(element.style);

    return styleClasses ? (
      <div key={`${reactKey}:style`} className={styleClasses} data-site-style-for={key}>
        {content}
      </div>
    ) : (
      content
    );
  };

  const items = resolveRepeatItems(element, scope);

  if (items === null) {
    return renderOnce(scope, key);
  }

  return (
    <Fragment key={key}>
      {items.map((item, index) =>
        renderOnce(
          { ...scope, item, index },
          `${key}:${repeatItemKey(item, index, element.repeat?.key)}`,
        ),
      )}
    </Fragment>
  );
}

export function SiteRenderer({
  page,
  boundState,
}: {
  page: SitePage;
  boundState?: Record<string, unknown>;
}) {
  const navigation = useSiteNavigation();
  const runtime = useSiteRuntime(page, boundState, navigation?.navigate);
  const scope = useMemo<SiteScope>(() => ({ state: runtime.state }), [runtime.state]);

  return <>{renderElement(page, page.root, scope, runtime, new Set())}</>;
}
