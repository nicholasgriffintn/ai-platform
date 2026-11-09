import { COVERAGE_TRACKER_PATH, DISCOVER_PATH } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import type { DiscoverGraphItem } from "./discover-items.js";

function readLinkedItem(
  storyId: string | undefined,
  entityId: string | undefined,
  pathname: string,
): DiscoverGraphItem | null {
  if (storyId) {
    return { type: "story", storyId };
  }

  if (entityId) {
    return { type: "entity", entityId };
  }

  return pathname === COVERAGE_TRACKER_PATH ? { type: "angles" } : null;
}

export function useDiscoverLinkedItem() {
  const { story_id: storyId, entity_id: entityId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [linked] = useState(() => readLinkedItem(storyId, entityId, pathname));

  const leave = () => {
    if (linked && pathname !== DISCOVER_PATH) {
      void navigate(DISCOVER_PATH, { replace: true });
    }
  };

  return { linked, leave };
}
