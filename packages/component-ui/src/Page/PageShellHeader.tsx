import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { PageHeader, PageHeaderActions, type PageHeaderAction } from "./PageHeader";
import { PageTitle } from "./PageTitle";

export interface PageShellHeaderDefinition {
  title: string;
  actions?: PageHeaderAction[];
  actionContent?: ReactNode;
}

interface PageShellHeaderContextValue {
  register: (owner: symbol, definition: PageShellHeaderDefinition) => void;
  unregister: (owner: symbol) => void;
}

export const PageShellHeaderContext = createContext<PageShellHeaderContextValue | null>(null);

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function PageShellHeader({ title, actions, actionContent }: PageShellHeaderDefinition) {
  const context = useContext(PageShellHeaderContext);
  const ownerRef = useRef(Symbol("page-shell-header"));

  useClientLayoutEffect(() => {
    if (!context) {
      return;
    }

    const owner = ownerRef.current;

    context.register(owner, { title, actions, actionContent });

    return () => context.unregister(owner);
  }, [actionContent, actions, context, title]);

  if (context) {
    return null;
  }

  return (
    <PageHeader actions={actions}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <PageTitle title={title} />
        </div>
        {actionContent}
      </div>
    </PageHeader>
  );
}

export function PageShellHeaderActions({
  actions,
  actionContent,
}: Pick<PageShellHeaderDefinition, "actions" | "actionContent">) {
  if (actionContent) {
    return actionContent;
  }

  return actions?.length ? <PageHeaderActions actions={actions} /> : null;
}
