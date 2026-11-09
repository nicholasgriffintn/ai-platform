import { DiscoverEntityItem } from "../../Story/DiscoverEntityItem.js";
import { DiscoverStoryItem } from "../../Story/DiscoverStoryItem.js";
import { DiscoverAnglesItem } from "../../Tracker/DiscoverAnglesItem.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import type { DiscoverGraphItem } from "./discover-items.js";

export function DiscoverGraphItemView({
  item,
  controller,
  playEntrance,
}: {
  item: DiscoverGraphItem;
  controller: DiscoverEditionController;
  playEntrance: (content: HTMLElement | null) => void;
}) {
  const { openStory, openEntity, closePanel } = controller;

  switch (item.type) {
    case "story":
      return (
        <DiscoverStoryItem
          storyId={item.storyId}
          contentRef={playEntrance}
          onOpenStory={openStory}
          onOpenEntity={openEntity}
          onClose={closePanel}
        />
      );
    case "entity":
      return (
        <DiscoverEntityItem
          entityId={item.entityId}
          contentRef={playEntrance}
          onOpenStory={openStory}
          onClose={closePanel}
        />
      );
    case "angles":
      return (
        <DiscoverAnglesItem
          contentRef={playEntrance}
          onOpenStory={openStory}
          onOpenEntity={openEntity}
          onClose={closePanel}
        />
      );
  }
}
