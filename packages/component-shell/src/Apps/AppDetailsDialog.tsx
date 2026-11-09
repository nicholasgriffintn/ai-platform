import { getIcon, getIconContainerClass } from "@ngriffin_uk/polychat-component-capabilities";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import { getAppProvenance } from "@ngriffin_uk/polychat-library-react";
import type { AppIosDecision, ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";
import { ExternalLink } from "lucide-react";

const IOS_LABELS: Record<AppIosDecision, string> = {
  native: "Works on iPhone",
  "results-only": "Results on iPhone",
  "web-only": "Web only on iPhone",
};

export interface AppDetailsDialogProps {
  app: ProjectExperienceDefinition | null;
  toggle?: { enabled: boolean; isPending: boolean; onToggle: (enabled: boolean) => void };
  onOpen?: () => void;
  onOpenChange: (open: boolean) => void;
}

export function AppDetailsDialog({ app, toggle, onOpen, onOpenChange }: AppDetailsDialogProps) {
  if (!app) {
    return null;
  }

  const provenance = getAppProvenance(app) ?? "Built into Polychat";
  const isOpenable = !toggle || toggle.enabled;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <div className="flex flex-col items-center px-2 pt-4 pb-2 text-center">
          <span
            className={`flex size-20 items-center justify-center rounded-2xl ${getIconContainerClass(app.theme)}`}
          >
            {getIcon(app.icon, app.theme, "size-10")}
          </span>
          <DialogTitle className="mt-5 text-2xl">{app.name}</DialogTitle>
          <DialogDescription className="mt-1">{provenance}</DialogDescription>
          <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">{app.description}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Badge variant="outline">{app.category}</Badge>
            {app.type === "premium" && <Badge variant="info">Pro</Badge>}
            {app.scope === "personal" && (
              <Badge variant="outline" title={app.scopeReason ?? undefined}>
                Personal only
              </Badge>
            )}
            <Badge variant="outline">{IOS_LABELS[app.ios]}</Badge>
          </div>
          <dl className="mt-6 w-full space-y-4 border-t border-border pt-5 text-left text-sm">
            <div>
              <dt className="font-medium text-foreground">When to use it</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">{app.when}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">What it works from</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">{app.uses}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">What it leaves behind</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">{app.produces}</dd>
            </div>
          </dl>
          {toggle && (
            <div className="mt-6 flex w-full items-center justify-between border-t border-border pt-5">
              <span className="text-sm font-medium text-foreground">Show in my apps</span>
              <Switch
                aria-label={`Turn ${app.name} ${toggle.enabled ? "off" : "on"}`}
                checked={toggle.enabled}
                disabled={toggle.isPending}
                onChange={(event) => toggle.onToggle(event.target.checked)}
              />
            </div>
          )}
          {onOpen && (
            <Button
              className="mt-6 w-full"
              icon={<ExternalLink size={15} />}
              disabled={!isOpenable}
              onClick={onOpen}
            >
              Open {app.name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
