import { SharedAgentsBrowser as ControlledSharedAgentsBrowser } from "@ngriffin_uk/polychat-component-account";

import { useAgentFilters } from "~/hooks/useAgentFilters";
import { useSharedAgents } from "~/hooks/useSharedAgents";

interface SharedAgentsBrowserProps {
  onInstall: (agentId: string) => Promise<any>;
  isInstalling: boolean;
}

export function SharedAgentsBrowser({ onInstall, isInstalling }: SharedAgentsBrowserProps) {
  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
  } = useAgentFilters();

  const {
    sharedAgents,
    isLoadingSharedAgents,
    featuredAgents,
    isLoadingFeaturedAgents,
    categories,
    tags,
  } = useSharedAgents({
    category: selectedCategory,
    tags: selectedTag ? [selectedTag] : [],
    search: debouncedSearchTerm,
  });

  return (
    <ControlledSharedAgentsBrowser
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      selectedCategory={selectedCategory}
      onSelectedCategoryChange={setSelectedCategory}
      selectedTag={selectedTag}
      onSelectedTagChange={setSelectedTag}
      categories={categories}
      tags={tags}
      sharedAgents={sharedAgents}
      featuredAgents={featuredAgents}
      isLoadingSharedAgents={isLoadingSharedAgents}
      isLoadingFeaturedAgents={isLoadingFeaturedAgents}
      onInstall={onInstall}
      isInstalling={isInstalling}
    />
  );
}
