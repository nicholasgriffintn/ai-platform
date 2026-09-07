import { Button, ButtonLink, PetSprite } from "@ngriffin_uk/polychat-component-ui";
import { shouldShowDevTools } from "@ngriffin_uk/polychat-library-client";
import { PET_CLIPS, PET_SHEET_LAYOUT } from "@ngriffin_uk/polychat-schemas";

import { PageShell } from "../Shell/PageShell";
export interface ErrorRouteProps {
  message: string;
  details: string;
  stack?: string;
}

export function ErrorPage({ message, details, stack }: ErrorRouteProps) {
  const shouldShowStack = Boolean(stack) && shouldShowDevTools();

  return (
    <PageShell className="flex h-dvh w-full max-w-full overflow-hidden bg-canvas">
      <div className="w-full flex-1 space-y-3 overflow-auto p-4">
        <PetSprite
          sheetUrl="/pets/ash.png"
          layout={PET_SHEET_LAYOUT}
          clip={PET_CLIPS.fret}
          label="Ash, out of sorts"
          size={64}
          paused
        />
        <div className="truncate text-base font-semibold text-muted-foreground">{message}</div>
        <div className="text-sm text-muted-foreground">{details}</div>
        {shouldShowStack ? (
          <div className="text-sm break-words text-muted-foreground">{stack}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <ButtonLink variant="outline" size="sm" href="/">
            Back to the nest
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
