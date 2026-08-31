import { SharedAgentsBrowser } from "@ngriffin_uk/polychat-component-account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { useAgentFilters } from "~/hooks/useAgentFilters";
import { useSharedAgents } from "~/hooks/useSharedAgents";

interface SharedAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharedAgentsDialog({ open, onOpenChange }: SharedAgentsDialogProps) {
  const filters = useAgentFilters();
  const [installingAgentId, setInstallingAgentId] = useState<string>();
  const {
    sharedAgents,
    isLoadingSharedAgents,
    featuredAgents,
    isLoadingFeaturedAgents,
    installSharedAgent,
    isInstalling,
    categories,
    tags,
  } = useSharedAgents(
    {
      category: filters.selectedCategory || undefined,
      tags: filters.selectedTag ? [filters.selectedTag] : undefined,
      search: filters.debouncedSearchTerm || undefined,
    },
    open,
  );

  const install = async (sharedAgentId: string) => {
    setInstallingAgentId(sharedAgentId);

    try {
      await installSharedAgent(sharedAgentId);
      onOpenChange(false);
    } catch {
      setInstallingAgentId(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Shared agents</DialogTitle>
          <DialogDescription>
            Install a copy of an agent someone else has published. The copy is yours to edit.
          </DialogDescription>
        </DialogHeader>
        <SharedAgentsBrowser
          categories={categories}
          featuredAgents={featuredAgents}
          installingAgentId={installingAgentId}
          isInstalling={isInstalling}
          isLoadingFeaturedAgents={isLoadingFeaturedAgents}
          isLoadingSharedAgents={isLoadingSharedAgents}
          onInstall={(sharedAgentId) => void install(sharedAgentId)}
          onSearchTermChange={filters.setSearchTerm}
          onSelectedCategoryChange={filters.setSelectedCategory}
          onSelectedTagChange={filters.setSelectedTag}
          searchTerm={filters.searchTerm}
          selectedCategory={filters.selectedCategory}
          selectedTag={filters.selectedTag}
          sharedAgents={sharedAgents}
          tags={tags}
        />
      </DialogContent>
    </Dialog>
  );
}
