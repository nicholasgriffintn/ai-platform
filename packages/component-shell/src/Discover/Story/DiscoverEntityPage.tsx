import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { DISCOVER_PATH, useStoryEntity } from "@ngriffin_uk/polychat-library-react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { ChatConversationShell } from "../../Shell/ChatConversationShell.js";
import { EntityBody } from "./EntityBody.js";

function EntityMessage({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function EntityContent({ entityId }: { entityId: string | undefined }) {
  const { data, error, isPending } = useStoryEntity(entityId);

  if (isPending) {
    return <EntityMessage>Loading</EntityMessage>;
  }

  if (error || !data) {
    return (
      <EntityMessage>
        {error instanceof ApiError && error.status === 404
          ? "This page is no longer available."
          : "Could not load this page. Try again shortly."}
      </EntityMessage>
    );
  }

  return <EntityBody page={data} />;
}

export function DiscoverEntityPage() {
  const { entity_id: entityId } = useParams();

  return (
    <ChatConversationShell title="Discover">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto px-5 py-8">
        <Link
          to={DISCOVER_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Discover
        </Link>
        <EntityContent entityId={entityId} />
      </div>
    </ChatConversationShell>
  );
}
