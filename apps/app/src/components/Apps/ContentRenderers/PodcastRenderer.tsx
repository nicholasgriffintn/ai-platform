import type { Podcast } from "~/types/podcast";
import { PodcastView } from "../Podcasts/View";

interface PodcastRendererProps {
  data: Podcast;
}

/**
 * Renders podcast content for both user and shared views
 */
export const PodcastRenderer = ({ data }: PodcastRendererProps) => {
  return <PodcastView podcast={data} />;
};
