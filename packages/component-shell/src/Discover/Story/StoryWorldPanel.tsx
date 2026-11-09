import {
  getNotebookPath,
  getPersonalConversationPath,
  PERSONAL_SURFACE,
  useStoryWorld,
} from "@ngriffin_uk/polychat-library-react";
import type { StoryWorldItem } from "@ngriffin_uk/polychat-schemas";
import { Link } from "react-router";

import { StorySection } from "./StorySection.js";

const KIND_LABELS: Record<StoryWorldItem["kind"], string> = {
  chat: "Chat",
  notebook: "Notebook",
  memory: "Memory",
};

function getItemPath(item: StoryWorldItem): string | null {
  if (item.kind !== "chat") {
    return null;
  }

  return item.notebookId
    ? getNotebookPath(PERSONAL_SURFACE, item.notebookId, item.id)
    : getPersonalConversationPath(item.id);
}

function WorldItem({ item }: { item: StoryWorldItem }) {
  const path = getItemPath(item);
  const title = item.title || KIND_LABELS[item.kind];
  const body = (
    <>
      <span className="truncate text-xs text-muted-foreground">
        {KIND_LABELS[item.kind]} · mentions {item.matched}
      </span>
      <span className="line-clamp-2 text-sm leading-snug font-medium text-foreground">{title}</span>
      {item.snippet ? (
        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.snippet}
        </span>
      ) : null}
    </>
  );

  return (
    <li>
      {path ? (
        <Link
          to={path}
          className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="flex flex-col gap-0.5 px-3 py-2.5">{body}</div>
      )}
    </li>
  );
}

export function StoryWorldPanel({ storyId }: { storyId: string }) {
  const { data } = useStoryWorld(storyId);

  if (!data || (!data.items.length && !data.searched.length)) {
    return null;
  }

  return (
    <StorySection title="In your world">
      {data.items.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {data.items.map((item) => (
            <WorldItem key={`${item.kind}:${item.id}`} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing in your chats, notebooks or memories mentions{" "}
          {data.searched.slice(0, 2).join(" or ")} yet.
        </p>
      )}
    </StorySection>
  );
}
