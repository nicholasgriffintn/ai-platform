import { getPersonalConversationPath, useStory } from "@ngriffin_uk/polychat-library-react";
import type { ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { useDeferredValue, useMemo, type Ref } from "react";

import { discoverItemKind } from "../Edition/item/discover-item-kind.js";
import { discoverItemKey } from "../Edition/item/discover-items.js";
import { DiscoverItemChat } from "../Edition/item/DiscoverItemChat.js";
import { DiscoverItemLead } from "../Edition/item/DiscoverItemLead.js";
import {
  DiscoverGraphFrame,
  DiscoverGraphHeader,
  DiscoverGraphStatus,
} from "./DiscoverGraphFrame.js";
import { storySuggestions, storySummary } from "./story-item.js";
import { StoryItemContent } from "./StoryItemContent.js";

export function DiscoverStoryItem({
  storyId,
  contentRef,
  onOpenStory,
  onOpenEntity,
  onClose,
}: {
  storyId: string;
  contentRef: Ref<HTMLDivElement>;
  onOpenStory: (storyId: string) => void;
  onOpenEntity: (entityId: string) => void;
  onClose: () => void;
}) {
  const { data, error } = useStory(storyId);
  const ready = useDeferredValue(data !== undefined, false);
  const kind = discoverItemKind({ type: "story", storyId });
  const itemKey = discoverItemKey({ type: "story", storyId });
  const subject = useMemo<ConversationSubject>(() => ({ type: "story", id: storyId }), [storyId]);
  const suggestions = useMemo(() => storySuggestions(storyId), [storyId]);

  if (!data || !ready) {
    return (
      <DiscoverGraphFrame kind={kind} itemKey={itemKey} contentRef={contentRef} onClose={onClose}>
        <DiscoverGraphStatus
          error={error}
          missing="This story is no longer available."
          failed="Could not load this story. Try again shortly."
        />
      </DiscoverGraphFrame>
    );
  }

  const summary = storySummary(data.story, subject);

  return (
    <DiscoverItemChat
      itemKey={itemKey}
      subject={subject}
      summary={summary}
      suggestions={suggestions}
      placeholder={kind.placeholder}
      readsLink={false}
      contentRef={contentRef}
      renderHeader={(conversationId) => (
        <DiscoverGraphHeader
          kind={kind}
          pageHref={conversationId ? getPersonalConversationPath(conversationId) : null}
          onClose={onClose}
        />
      )}
      renderLead={(chatting) => (
        <DiscoverItemLead summary={summary} chatting={chatting}>
          <StoryItemContent page={data} onOpenStory={onOpenStory} onOpenEntity={onOpenEntity} />
        </DiscoverItemLead>
      )}
    />
  );
}
