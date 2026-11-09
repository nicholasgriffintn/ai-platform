import { useStoryEntity } from "@ngriffin_uk/polychat-library-react";
import type { Ref } from "react";

import { discoverItemKind } from "../Edition/item/discover-item-kind.js";
import { discoverItemKey, type DiscoverGraphItem } from "../Edition/item/discover-items.js";
import { DiscoverGraphFrame, DiscoverGraphStatus } from "./DiscoverGraphFrame.js";
import { EntityItemContent } from "./EntityItemContent.js";

export function DiscoverEntityItem({
  entityId,
  contentRef,
  onOpenStory,
  onClose,
}: {
  entityId: string;
  contentRef: Ref<HTMLDivElement>;
  onOpenStory: (storyId: string) => void;
  onClose: () => void;
}) {
  const { data, error } = useStoryEntity(entityId);
  const item: DiscoverGraphItem = { type: "entity", entityId };

  return (
    <DiscoverGraphFrame
      kind={discoverItemKind(item)}
      itemKey={discoverItemKey(item)}
      contentRef={contentRef}
      onClose={onClose}
    >
      {data ? (
        <EntityItemContent page={data} onOpenStory={onOpenStory} />
      ) : (
        <DiscoverGraphStatus
          error={error}
          missing="This page is no longer available."
          failed="Could not load this page. Try again shortly."
        />
      )}
    </DiscoverGraphFrame>
  );
}
