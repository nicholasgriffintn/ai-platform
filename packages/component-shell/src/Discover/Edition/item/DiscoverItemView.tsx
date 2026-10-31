import { getPersonalConversationPath } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import { MoonStar } from "lucide-react";
import { useMemo } from "react";

import { discoverCardSuggestions, discoverMediaSuggestions } from "../discover-card-drafts.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import { discoverItemKind } from "./discover-item-kind.js";
import { discoverItemFileHref, discoverItemKey, type DiscoverItem } from "./discover-items.js";
import { DiscoverEpisodeMenu } from "./DiscoverEpisodeMenu.js";
import { DiscoverItemBlock } from "./DiscoverItemBlock.js";
import { DiscoverItemChat } from "./DiscoverItemChat.js";
import { DiscoverItemHeader } from "./DiscoverItemHeader.js";
import { useDiscoverItemSummary } from "./useDiscoverItemSummary.js";

function WindDownNote() {
  return (
    <p className="flex shrink-0 items-center justify-center gap-2 px-4 pt-2 pb-5 text-xs text-muted-foreground">
      <MoonStar size={13} aria-hidden />
      Chat is tucked away during Wind down
    </p>
  );
}

export function DiscoverItemView({
  item,
  edition,
  controller,
  playEntrance,
}: {
  item: DiscoverItem;
  edition: DiscoverEdition;
  controller: DiscoverEditionController;
  playEntrance: (content: HTMLElement | null) => void;
}) {
  const story = item.type === "media" && item.media === "story";
  const summary = useDiscoverItemSummary(
    item,
    edition,
    story ? controller.storyWindDownId : controller.windDownId,
  );
  const suggestions = useMemo(
    () =>
      item.type === "card"
        ? discoverCardSuggestions(item.card)
        : discoverMediaSuggestions(item.media),
    [item],
  );
  const kind = discoverItemKind(item);
  const itemKey = discoverItemKey(item);
  const fileHref = discoverItemFileHref(item, edition);
  const card = item.type === "card" ? item.card : null;
  const feedback = card ? controller.feedbackFor(card) : null;

  const renderHeader = (conversationId: string | undefined) => (
    <DiscoverItemHeader
      kind={kind}
      navigation={{
        position: controller.panelPosition,
        onPrev: () => controller.step(-1),
        onNext: () => controller.step(1),
        onClose: controller.closePanel,
      }}
      target={card && feedback ? { card, feedback } : null}
      menu={
        item.type === "media" && item.media === "episode" && edition.episodeId ? (
          <DiscoverEpisodeMenu episodeId={edition.episodeId} />
        ) : undefined
      }
      pageHref={conversationId ? getPersonalConversationPath(conversationId) : fileHref}
    />
  );
  const renderLead = (chatting: boolean) => (
    <DiscoverItemBlock
      item={item}
      summary={summary}
      chatting={chatting}
      controller={controller}
      edition={edition}
    />
  );

  if (summary.subject) {
    return (
      <DiscoverItemChat
        itemKey={itemKey}
        subject={summary.subject}
        summary={summary}
        suggestions={suggestions}
        placeholder={kind.placeholder}
        readsLink={card?.kind === "read" && !card.sourceId}
        contentRef={playEntrance}
        renderHeader={renderHeader}
        renderLead={renderLead}
      />
    );
  }

  return (
    <>
      {renderHeader(undefined)}
      <div
        ref={playEntrance}
        data-discover-panel-item={itemKey}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">
          {renderLead(false)}
        </div>
        {item.type === "media" && (item.media === "wind_down" || story) ? <WindDownNote /> : null}
      </div>
    </>
  );
}
