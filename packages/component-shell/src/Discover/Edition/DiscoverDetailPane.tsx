import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectWorkbenchShell,
  type ProjectWorkbenchHeaderSlots,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useProjectWorkbenchLayout } from "@ngriffin_uk/polychat-library-react";
import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";

import { discoverCardEyebrow, discoverCardHeadline } from "./discover-card-drafts.js";
import { DiscoverAskPanel } from "./DiscoverAskPanel.js";
import { DiscoverCardRail } from "./DiscoverCardRail.js";
import { DiscoverCardToolbar, type DiscoverCardToolbarProps } from "./DiscoverCardToolbar.js";
import { DiscoverCover } from "./DiscoverTopicTile.js";

const DISCOVER_WORKBENCH_LAYOUT_KEY = "polychat:discover-workbench";

export interface DiscoverDetailPaneProps extends DiscoverCardToolbarProps {
  editionId: string;
  topicArticleCount: number;
  onClose: () => void;
}

function DiscoverDetailHeader({
  actions,
  onClose,
  ...toolbar
}: DiscoverCardToolbarProps & { actions: ReactNode; onClose: () => void }) {
  const { card } = toolbar;

  return (
    <header className="shrink-0 border-b border-border px-5 pt-4 pb-3 sm:px-6">
      <div className="flex items-start gap-3">
        {card.kind === "topic" ? (
          <div className="size-12 shrink-0 overflow-hidden rounded-lg">
            <DiscoverCover card={card} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="polychat-eyebrow truncate">{discoverCardEyebrow(card)}</p>
          <h2 className="mt-1 font-display text-xl leading-tight font-medium tracking-tight text-balance text-foreground xl:text-2xl">
            {discoverCardHeadline(card)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button variant="icon" size="icon" aria-label="Close" onClick={onClose}>
            <span className="lg:hidden">
              <ArrowLeft size={16} aria-hidden />
            </span>
            <span className="hidden lg:inline">
              <X size={16} aria-hidden />
            </span>
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <DiscoverCardToolbar {...toolbar} />
      </div>
    </header>
  );
}

export function DiscoverDetailPane({
  editionId,
  topicArticleCount,
  onClose,
  ...toolbar
}: DiscoverDetailPaneProps) {
  const layout = useProjectWorkbenchLayout(DISCOVER_WORKBENCH_LAYOUT_KEY);
  const { card } = toolbar;
  const header = ({ actions }: ProjectWorkbenchHeaderSlots) => (
    <DiscoverDetailHeader {...toolbar} actions={actions} onClose={onClose} />
  );

  return (
    <ProjectWorkbenchShell
      title="Discover card"
      status="ready"
      showStatus={false}
      layout={layout}
      panels={{}}
      availablePanes={[]}
      header={header}
      context={
        <DiscoverCardRail editionId={editionId} card={card} topicArticleCount={topicArticleCount} />
      }
      conversation={
        <div className="flex h-full min-h-0 flex-col">
          <DiscoverAskPanel key={card.id} editionId={editionId} card={card} />
        </div>
      }
    />
  );
}
