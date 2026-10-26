import { Switch, TextLink } from "@ngriffin_uk/polychat-component-ui";
import {
  getPluginsPath,
  PERSONAL_SURFACE,
  useKnowledgeSettings,
  useKnowledgeSettingsUpdate,
} from "@ngriffin_uk/polychat-library-react";
import type { KnowledgeEnricherSettings } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

const ENRICHERS: readonly {
  key: keyof KnowledgeEnricherSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "summary",
    label: "Summaries",
    description: "A summary and key points, used when a file is too long to quote whole.",
  },
  {
    key: "classify",
    label: "Topics",
    description: "Files each one under topics and the people, places and projects it is about.",
  },
  {
    key: "relate",
    label: "Related files",
    description: "Notes which files cite, repeat or were made from each other.",
  },
];

export function KnowledgeReadingSettings({ projectId }: { projectId?: string }) {
  const { data: settings } = useKnowledgeSettings(projectId);
  const update = useKnowledgeSettingsUpdate(projectId);

  if (!settings) {
    return null;
  }

  const save = (input: Parameters<typeof update.mutate>[0]) =>
    update.mutate(input, {
      onError: (error) => toast.error(getErrorMessage(error, "That setting did not stick.")),
    });
  const disabled = !settings.canManage || update.isPending;

  return (
    <div className="flex flex-col gap-4">
      {ENRICHERS.map((enricher) => (
        <Switch
          key={enricher.key}
          label={enricher.label}
          description={enricher.description}
          checked={settings.enrichers[enricher.key]}
          disabled={disabled}
          onChange={(event) =>
            save({ enrichers: { ...settings.enrichers, [enricher.key]: event.target.checked } })
          }
        />
      ))}
      {settings.providers.map((provider) =>
        projectId ? (
          <Switch
            key={provider.provider}
            label={`Search ${provider.name}`}
            description={
              provider.connected
                ? "Uses your connection, searched alongside this project's files."
                : "Connect it in Plugins first."
            }
            checked={provider.attached}
            disabled={disabled || (!provider.connected && !provider.attached)}
            onChange={(event) =>
              save({ providers: [{ provider: provider.provider, attached: event.target.checked }] })
            }
          />
        ) : null,
      )}
      {projectId ? null : (
        <p className="text-sm text-muted-foreground">
          Knowledge bases you connect, such as Amazon Bedrock or Cloudflare AI Search, are searched
          alongside your files.{" "}
          <TextLink href={getPluginsPath(PERSONAL_SURFACE)} size="sm">
            Connect one in Plugins
          </TextLink>
        </p>
      )}
    </div>
  );
}
