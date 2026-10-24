import {
  Button,
  ButtonLink,
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
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { X } from "lucide-react";
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
  follows: readonly DiscoverFollow[];
  onUnfollow: (notebookId: string) => void;
  onToggle: (enabled: boolean) => void;
  onUseSource: (providerId: string, used: boolean) => void;
  onSaveCurate: (curate: string) => void;
  onSavePreferences: (
    preferences: Pick<UpdateDiscoverSettings, "listen" | "episode" | "style" | "notify">,
  ) => void;
}

export function DiscoverSettingsDialog({
  open,
  onOpenChange,
  settings,
  isSaving,
  follows,
  onUnfollow,
  onToggle,
  onUseSource,
  onSaveCurate,
  onSavePreferences,
}: DiscoverSettingsDialogProps) {
  const [curate, setCurate] = useState(settings.curate);
  const changed = curate.trim() !== settings.curate.trim();

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
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">Connected services</p>
                <p className="text-xs text-muted-foreground">
                  What you read, watch and listen to elsewhere, for Discover to work from.
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {settings.sources.map((source) => (
                  <li key={source.providerId}>
                    {source.connected ? (
                      <Switch
                        label={source.name}
                        description={source.description}
                        checked={source.used}
                        disabled={isSaving}
                        onChange={(event) => onUseSource(source.providerId, event.target.checked)}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm text-foreground">{source.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {source.description}
                          </span>
                        </div>
                        <ButtonLink
                          href={getPlacePaths("chat").plugins}
                          variant="outline"
                          size="sm"
                        >
                          Connect
                        </ButtonLink>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
