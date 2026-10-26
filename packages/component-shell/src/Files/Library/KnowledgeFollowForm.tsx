import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeDescriptors,
  useKnowledgeFeedCreate,
  useKnowledgeServiceCreate,
  type KnowledgeSyncTarget,
} from "@ngriffin_uk/polychat-library-react";
import type { KnowledgeDescriptorSummary, KnowledgeFeed } from "@ngriffin_uk/polychat-schemas";
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

function describeService(descriptor: KnowledgeDescriptorSummary): string {
  return `${descriptor.description} Uses your connected account${
    descriptor.incremental ? ", and later checks only read what changed." : "."
  }`;
}

export function KnowledgeFollowForm({
  target,
  onDone,
}: {
  target: KnowledgeSyncTarget;
  onDone: () => void;
}) {
  const canFollowServices = !("library" in target);
  const createFeed = useKnowledgeFeedCreate(target);
  const createService = useKnowledgeServiceCreate();
  const { data: descriptors = [] } = useKnowledgeDescriptors();
  const services = canFollowServices ? descriptors : [];
  const [choice, setChoice] = useState<string>("rss");
  const [value, setValue] = useState("");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const feed = FEED_KINDS.find((option) => option.value === choice);
  const service = services.find((descriptor) => `service:${descriptor.id}` === choice);
  const trimmed = value.trim();
  const isValid = service
    ? service.parameters.every(
        (parameter) => !parameter.required || Boolean(parameters[parameter.name]?.trim()),
      )
    : choice === "rss"
      ? URL.canParse(trimmed)
      : trimmed.length >= 2;

  const follow = async () => {
    try {
      if (service) {
        await createService.mutateAsync({
          ...("projectId" in target ? { projectId: target.projectId } : {}),
          ...("notebookId" in target ? { notebookId: target.notebookId } : {}),
          title: service.title,
          descriptor: { id: service.id, parameters },
          intervalMinutes: 180,
        });
      } else if (feed) {
        await createFeed.mutateAsync({
          title: (feed.value === "rss" ? readUrlHost(trimmed) || trimmed : trimmed).slice(0, 200),
          feed: buildFeed(feed.value, trimmed),
        });
      }

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
        options={[
          ...FEED_KINDS,
          ...services.map((descriptor) => ({
            value: `service:${descriptor.id}`,
            label: descriptor.title,
          })),
        ]}
        value={choice}
        onValueChange={(next) => {
          setChoice(next);
          setParameters({});
        }}
        description={service ? describeService(service) : feed?.description}
        fullWidth
      />
      {service ? (
        service.parameters.map((parameter) => (
          <FormInput
            key={parameter.name}
            label={parameter.required ? parameter.label : `${parameter.label} (optional)`}
            description={parameter.description}
            value={parameters[parameter.name] ?? ""}
            onChange={(event) =>
              setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))
            }
            fullWidth
          />
        ))
      ) : feed ? (
        <FormInput
          label={feed.field}
          type={feed.value === "rss" ? "url" : "text"}
          placeholder={feed.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          fullWidth
        />
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={!isValid}
        isLoading={createFeed.isPending || createService.isPending}
      >
        Follow
      </Button>
    </form>
  );
}
