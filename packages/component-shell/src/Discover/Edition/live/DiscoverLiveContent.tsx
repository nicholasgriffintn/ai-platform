import { LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverExposure } from "@ngriffin_uk/polychat-library-react";
import { useLoadMoreOnIntersect } from "@ngriffin_uk/polychat-utility-react";

import { DiscoverFeed } from "../DiscoverFeed.js";
import { DiscoverMediaShelf } from "../DiscoverMediaShelf.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import { DiscoverContentLink } from "./DiscoverContentLink.js";
import { DiscoverSourceNotice } from "./DiscoverSourceNotice.js";
import { useDiscoverCurrentRefresh } from "./useDiscoverCurrentRefresh.js";
import { useDiscoverSinceLastVisit } from "./useDiscoverSinceLastVisit.js";

export function DiscoverLiveContent({ controller }: { controller: DiscoverEditionController }) {
  const exposure = useDiscoverExposure(controller.liveFeed.items);
  const more = useLoadMoreOnIntersect({
    enabled: controller.liveFeed.hasMore && !controller.liveFeed.error,
    isLoading: controller.liveFeed.isLoadingMore,
    onLoadMore: controller.liveFeed.loadMore,
  });

  const newCardIds = useDiscoverSinceLastVisit(controller.liveFeed.items);

  useDiscoverCurrentRefresh(controller.discover.data?.now, controller.settings?.enabled ?? false);
  const edition = controller.edition;
  const mediaEdition = controller.mediaEdition;

  if (!edition) {
    return null;
  }

  return (
    <div ref={exposure}>
      <DiscoverContentLink
        items={controller.liveFeed.items}
        onSelect={controller.select}
        onListen={controller.openBriefing}
        hasMore={controller.liveFeed.hasMore && !controller.liveFeed.error}
        isLoadingMore={controller.liveFeed.isLoadingMore}
        loadMore={controller.liveFeed.loadMore}
      />
      <DiscoverSourceNotice sources={controller.settings?.sources} />
      <DiscoverFeed
        edition={edition}
        newCardIds={newCardIds}
        selectedId={controller.selectedCard?.id ?? null}
        isTopicHidden={controller.isTopicHidden}
        isFollowing={(card) => Boolean(controller.followFor(card))}
        onSelect={controller.select}
        startingStoryId={controller.startingStoryId}
        failedStoryId={controller.failedStoryId}
        openStoryId={controller.openStoryId}
        onStartStory={controller.startStory}
        mediaCount={mediaEdition ? controller.mediaShelf.length : 0}
        media={
          mediaEdition ? (
            <DiscoverMediaShelf
              edition={mediaEdition}
              media={controller.mediaShelf}
              awaitingEpisode={controller.isAwaitingEpisode}
              windDownId={controller.windDownId}
              active={controller.panelItem?.type === "media" ? controller.media : null}
              onOpen={controller.openMedia}
            />
          ) : null
        }
      />
      <div ref={more} className="flex justify-center py-3">
        {controller.liveFeed.isLoadingMore ? <LoadingSpinner /> : null}
      </div>
    </div>
  );
}
