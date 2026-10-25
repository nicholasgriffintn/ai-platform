import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeFeedCreate,
  type KnowledgeSyncTarget,
} from "@ngriffin_uk/polychat-library-react";
import type { KnowledgeFeed } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

type FeedKind = KnowledgeFeed["kind"];

const FEED_KINDS: readonly {
  value: FeedKind;
  label: string;
  field: string;
  placeholder: string;
  description: string;
}[] = [
  {
    value: "rss",
    label: "A feed",
    field: "Feed address",
    placeholder: "https://example.com/feed.xml",
    description: "New posts from an RSS or Atom feed. These are read before any web search.",
  },
  {
    value: "news",
    label: "A news topic",
    field: "Topic",
    placeholder: "Japanese Grand Prix",
    description:
      "Fresh coverage, checked against your feeds first and searched only when they come up short.",
  },
  {
    value: "web",
    label: "A web topic",
    field: "Topic",
    placeholder: "Sourdough hydration",
    description: "Useful pages on the subject, found with a web search.",
  },
];

function buildFeed(kind: FeedKind, value: string): KnowledgeFeed {
  return kind === "rss" ? { kind, url: value } : { kind, query: value };
}

export function KnowledgeFeedForm({
  target,
  onDone,
}: {
  target: KnowledgeSyncTarget;
  onDone: () => void;
}) {
  const create = useKnowledgeFeedCreate(target);
  const [kind, setKind] = useState<FeedKind>("rss");
  const [value, setValue] = useState("");
  const selected = FEED_KINDS.find((option) => option.value === kind) ?? FEED_KINDS[0];
  const trimmed = value.trim();
  const isValid = kind === "rss" ? URL.canParse(trimmed) : trimmed.length >= 2;

  const follow = async () => {
    try {
      await create.mutateAsync({
        title: (kind === "rss" ? readUrlHost(trimmed) || trimmed : trimmed).slice(0, 200),
        feed: buildFeed(kind, trimmed),
      });
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "That one would not perch. Check it and try again."));
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void follow();
      }}
    >
      <FormSelect
        label="Follow"
        options={FEED_KINDS}
        value={kind}
        onValueChange={setKind}
        description={selected.description}
        fullWidth
      />
      <FormInput
        label={selected.field}
        type={kind === "rss" ? "url" : "text"}
        placeholder={selected.placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        fullWidth
      />
      <Button type="submit" variant="primary" disabled={!isValid} isLoading={create.isPending}>
        Follow
      </Button>
    </form>
  );
}
