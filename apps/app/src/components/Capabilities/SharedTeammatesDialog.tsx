import { SharedTeammatesBrowser } from "@ngriffin_uk/polychat-component-account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { useSharedTeammates } from "~/hooks/useSharedTeammates";
import { useTeammateFilters } from "~/hooks/useTeammateFilters";

interface SharedTeammatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharedTeammatesDialog({ open, onOpenChange }: SharedTeammatesDialogProps) {
  const filters = useTeammateFilters();
  const [installingTeammateId, setInstallingTeammateId] = useState<string>();
  const {
    sharedTeammates,
    isLoadingSharedTeammates,
    featuredTeammates,
    isLoadingFeaturedTeammates,
    installSharedTeammate,
    isInstalling,
    categories,
    tags,
  } = useSharedTeammates(
    {
      category: filters.selectedCategory || undefined,
      tags: filters.selectedTag ? [filters.selectedTag] : undefined,
      search: filters.debouncedSearchTerm || undefined,
    },
    open,
  );

  const install = async (sharedTeammateId: string) => {
    setInstallingTeammateId(sharedTeammateId);

    try {
      await installSharedTeammate(sharedTeammateId);
      onOpenChange(false);
    } catch {
      setInstallingTeammateId(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Shared teammates</DialogTitle>
          <DialogDescription>
            Install a copy of an teammate someone else has published. The copy is yours to edit.
          </DialogDescription>
        </DialogHeader>
        <SharedTeammatesBrowser
          categories={categories}
          featuredTeammates={featuredTeammates}
          installingTeammateId={installingTeammateId}
          isInstalling={isInstalling}
          isLoadingFeaturedTeammates={isLoadingFeaturedTeammates}
          isLoadingSharedTeammates={isLoadingSharedTeammates}
          onInstall={(sharedTeammateId) => void install(sharedTeammateId)}
          onSearchTermChange={filters.setSearchTerm}
          onSelectedCategoryChange={filters.setSelectedCategory}
          onSelectedTagChange={filters.setSelectedTag}
          searchTerm={filters.searchTerm}
          selectedCategory={filters.selectedCategory}
          selectedTag={filters.selectedTag}
          sharedTeammates={sharedTeammates}
          tags={tags}
        />
      </DialogContent>
    </Dialog>
  );
}
