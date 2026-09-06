import { SearchDialog as ControlledSearchDialog } from "@ngriffin_uk/polychat-component-navigation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useTrackEvent } from "@ngriffin_uk/polychat-library-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { useGlobalSearch } from "./useGlobalSearch";

type SearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const { results, debouncedQuery, error, isLoading, isUpdating } = useGlobalSearch(query);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const navigate = useNavigate();
  const { trackFeatureUsage } = useTrackEvent();

  const handleOpened = useCallback(() => {
    trackFeatureUsage("global_search_opened", {});
  }, [trackFeatureUsage]);

  return (
    <ControlledSearchDialog
      isOpen={isOpen}
      query={query}
      results={results}
      hasQuery={debouncedQuery.length > 0}
      hasError={Boolean(error)}
      isLoading={isLoading}
      isUpdating={isUpdating}
      onClose={onClose}
      onQueryChange={setQuery}
      onOpened={handleOpened}
      onSelect={(result, index, method) => {
        trackFeatureUsage("global_search_result_selected", {
          query_length: debouncedQuery.length,
          result_kind: result.kind,
          result_position: index + 1,
          selection_method: method,
        });
        if (result.kind === "conversation") {
          setCurrentConversationId(result.id.slice("conversation:".length));
        }

        void navigate(result.href);
        onClose();
      }}
    />
  );
}
