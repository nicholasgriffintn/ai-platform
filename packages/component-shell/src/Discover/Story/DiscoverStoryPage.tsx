import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { DISCOVER_PATH, useStory } from "@ngriffin_uk/polychat-library-react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { ChatConversationShell } from "../../Shell/ChatConversationShell.js";
import { StoryBody } from "./StoryBody.js";

function StoryMessage({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function StoryContent({ storyId }: { storyId: string | undefined }) {
  const { data, error, isPending } = useStory(storyId);

  if (isPending) {
    return <StoryMessage>Loading story</StoryMessage>;
  }

  if (error || !data) {
    return (
      <StoryMessage>
        {error instanceof ApiError && error.status === 404
          ? "This story is no longer available."
          : "Could not load this story. Try again shortly."}
      </StoryMessage>
    );
  }

  return <StoryBody page={data} />;
}

export function DiscoverStoryPage() {
  const { story_id: storyId } = useParams();

  return (
    <ChatConversationShell title="Story">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto px-5 py-8">
        <Link
          to={DISCOVER_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Discover
        </Link>
        <StoryContent storyId={storyId} />
      </div>
    </ChatConversationShell>
  );
}
