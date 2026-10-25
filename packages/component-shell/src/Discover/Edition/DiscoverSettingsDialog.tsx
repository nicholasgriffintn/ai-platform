import {
  Button,
  ButtonLink,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Switch,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  getNotebookPath,
  getPlacePaths,
  PERSONAL_SURFACE,
} from "@ngriffin_uk/polychat-library-react";
import {
  DISCOVER_CURATE_MAX_LENGTH,
  DISCOVER_EPISODE_LENGTHS,
  creditsFromCreditMicros,
  VIDEO_OVERVIEW_STYLE_LABELS,
  videoOverviewStyleSchema,
  type DiscoverEpisodeLength,
  type DiscoverFollow,
  type DiscoverSettings,
  type UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { RoutineSpendControl } from "../../Teammates/RoutineSpendControl.js";

const EPISODE_LENGTH_LABELS: Record<DiscoverEpisodeLength, string> = {
  off: "No episodes",
  short: "Short, about 5 minutes",
  standard: "Standard, about 12 minutes",
  long: "Long, about 20 minutes",
};

function episodeLengthOptions(
  costs: DiscoverSettings["episodeCosts"],
): { value: DiscoverEpisodeLength; label: string }[] {
  return DISCOVER_EPISODE_LENGTHS.map((value) => ({
    value,
    label:
      value !== "off" && costs
        ? `${EPISODE_LENGTH_LABELS[value]} · about ${formatCredits(creditsFromCreditMicros(costs[value]))} credits`
        : EPISODE_LENGTH_LABELS[value],
  }));
}

const STYLE_OPTIONS = videoOverviewStyleSchema.options.map((value) => ({
  value,
  label: VIDEO_OVERVIEW_STYLE_LABELS[value],
}));

export interface DiscoverSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: DiscoverSettings;
  isSaving: boolean;
  canWriteAgain: boolean;
  isWriting: boolean;
  onWriteAgain: () => void;
  follows: readonly DiscoverFollow[];
  onUnfollow: (notebookId: string) => void;
  onToggle: (enabled: boolean) => void;
  onUseSource: (providerId: string, used: boolean) => void;
  onSaveCurate: (curate: string) => void;
  onSavePreferences: (
    preferences: Pick<
      UpdateDiscoverSettings,
      "listen" | "evening" | "episode" | "style" | "notify"
    >,
  ) => void;
}

function describeSourceHealth(source: DiscoverSettings["sources"][number]): string {
  if (source.lastError) {
    return `Could not be read: ${source.lastError}`;
  }

  if (source.lastReadAt) {
    return `Read ${formatRelativeTime(source.lastReadAt)}. ${source.description}`;
  }

  return source.description;
}

export function DiscoverSettingsDialog({
  open,
  onOpenChange,
  settings,
  isSaving,
  canWriteAgain,
  isWriting,
  onWriteAgain,
  follows,
  onUnfollow,
  onToggle,
  onUseSource,
  onSaveCurate,
  onSavePreferences,
}: DiscoverSettingsDialogProps) {
  const [curate, setCurate] = useState(settings.curate);
  const [showSources, setShowSources] = useState(false);
  const changed = curate.trim() !== settings.curate.trim();
  const connectedSources = settings.sources.filter((source) => source.connected);
  const usedSources = connectedSources.filter((source) => source.used);
  const unconnectedCount = settings.sources.length - connectedSources.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Discover settings</DialogTitle>
          <DialogDescription>
            What Poly writes each morning, and what it makes from it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <Switch
            label="Morning edition"
            description={
              settings.enabled
                ? `Poly writes a new edition at 07:00${settings.timezone ? ` ${settings.timezone} time` : ""}.`
                : "Off. Your earlier editions stay here."
            }
            checked={settings.enabled}
            disabled={isSaving}
            onChange={(event) => onToggle(event.target.checked)}
          />
          {settings.enabled && (
            <>
              <Switch
                label="Tell me when it's ready"
                description="Poly lets you know on your phone and connected channels when the edition lands."
                checked={settings.notify}
                disabled={isSaving}
                onChange={(event) => onSavePreferences({ notify: event.target.checked })}
              />
              <Switch
                label="Evening edition"
                description="A second, shorter edition at 19:00 that looks at tomorrow."
                checked={settings.evening}
                disabled={isSaving}
                onChange={(event) => onSavePreferences({ evening: event.target.checked })}
              />
              <Switch
                label="The Perch"
                description="A short two-host round-up of each edition, also in your podcast feed."
                checked={settings.listen}
                disabled={isSaving}
                onChange={(event) => onSavePreferences({ listen: event.target.checked })}
              />
              <FormSelect
                label="Daily episode"
                options={episodeLengthOptions(settings.episodeCosts)}
                value={settings.episode}
                disabled={isSaving}
                fullWidth
                onValueChange={(episode) => onSavePreferences({ episode })}
              />
              {settings.episode !== "off" && (
                <FormSelect
                  label="Episode style"
                  options={STYLE_OPTIONS}
                  value={settings.style}
                  disabled={isSaving}
                  fullWidth
                  onValueChange={(style) => onSavePreferences({ style })}
                />
              )}
            </>
          )}
          {settings.enabled && settings.sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">Connected services</p>
                  <p className="text-xs text-muted-foreground">
                    {connectedSources.length === 0
                      ? "Nothing connected yet. Connect what you read, watch and listen to and Discover works from it."
                      : `Reading ${usedSources.length === connectedSources.length ? "all" : usedSources.length} of your ${connectedSources.length} connected services${unconnectedCount > 0 ? `, ${unconnectedCount} more could be connected` : ""}.`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSources((current) => !current)}
                >
                  {showSources ? "Done" : "Change"}
                </Button>
              </div>
              {showSources && (
                <ul className="flex flex-col gap-2">
                  {connectedSources.map((source) => (
                    <li key={source.providerId}>
                      <Switch
                        label={source.name}
                        description={describeSourceHealth(source)}
                        checked={source.used}
                        disabled={isSaving}
                        onChange={(event) => onUseSource(source.providerId, event.target.checked)}
                      />
                    </li>
                  ))}
                  {unconnectedCount > 0 && (
                    <li className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-muted-foreground">
                        {settings.sources
                          .filter((source) => !source.connected)
                          .map((source) => source.name)
                          .join(", ")}
                      </span>
                      <ButtonLink href={getPlacePaths("chat").plugins} variant="outline" size="sm">
                        Connect
                      </ButtonLink>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          {settings.enabled && settings.installationId && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">Monthly budget</p>
                <p className="text-xs text-muted-foreground">
                  Each morning's edition, its episode, The Perch and Your week count here. When it
                  runs short, episodes get shorter rather than stopping.
                </p>
              </div>
              <RoutineSpendControl installationId={settings.installationId} />
            </div>
          )}
          {follows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">Following</p>
              <ul className="flex flex-wrap gap-2">
                {follows.map((follow) => (
                  <li
                    key={follow.notebookId}
                    className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-3 text-xs"
                  >
                    <Link
                      to={getNotebookPath(PERSONAL_SURFACE, follow.notebookId)}
                      className="text-foreground hover:underline"
                    >
                      {follow.topic}
                    </Link>
                    <button
                      type="button"
                      aria-label={`Stop following ${follow.topic}`}
                      className="rounded-full p-1 text-muted-foreground hover:bg-selection hover:text-foreground"
                      onClick={() => onUnfollow(follow.notebookId)}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {settings.enabled && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSaveCurate(curate.trim());
              }}
            >
              <label htmlFor="discover-curate" className="text-sm font-medium text-foreground">
                Ask for something
              </label>
              <Textarea
                id="discover-curate"
                value={curate}
                maxLength={DISCOVER_CURATE_MAX_LENGTH}
                rows={3}
                placeholder="The Japanese Grand Prix, rye starters, anything new on Rust"
                onChange={(event) => setCurate(event.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!changed || isSaving}>
                  Save for the next edition
                </Button>
              </div>
            </form>
          )}
          {settings.enabled && canWriteAgain && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">Today's edition</p>
                <p className="text-xs text-muted-foreground">
                  Poly writes a fresh one now, with anything you asked for above.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWriting}
                onClick={() => {
                  onWriteAgain();
                  onOpenChange(false);
                }}
              >
                <RefreshCw size={14} aria-hidden className={cn(isWriting && "animate-spin")} />
                {isWriting ? "Writing" : "Write again"}
              </Button>
            </div>
          )}
          {settings.enabled && (
            <p className="text-xs text-muted-foreground">
              {settings.location
                ? `Weather and what is on nearby use ${settings.location}, from your account.`
                : "Add a location to your account and Discover will bring in the weather and what is on nearby."}{" "}
              <Link to="/profile" className="text-foreground underline">
                Profile
              </Link>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
