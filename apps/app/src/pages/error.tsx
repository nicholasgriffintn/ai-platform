import { Button, ButtonLink, PetSprite } from "@ngriffin_uk/polychat-component-ui";
import { PET_CLIPS, PET_SHEET_LAYOUT } from "@ngriffin_uk/polychat-schemas";

import { PageShell } from "~/components/Core/PageShell";
import { shouldShowDevTools } from "~/constants";

interface ErrorRouteProps {
  message: string;
  details: string;
  stack?: string;
}

export function meta() {
  return {
    title: "Error - Polychat",
    description: "An error occurred while loading the page",
  };
}

export default function ErrorRoute({ message, details, stack }: ErrorRouteProps) {
  const shouldShowStack = Boolean(stack) && shouldShowDevTools();

  return (
    <PageShell className="bg-canvas flex h-dvh w-full max-w-full overflow-hidden">
      <div className="flex-1 overflow-auto w-full space-y-3 p-4">
        <PetSprite
          sheetUrl="/pets/ash.webp"
          layout={PET_SHEET_LAYOUT}
          clip={PET_CLIPS.fret}
          label="Ash, out of sorts"
          size={64}
          paused
        />
        <div className="text-base font-semibold text-muted-foreground truncate">{message}</div>
        <div className="text-sm text-muted-foreground">{details}</div>
        {shouldShowStack ? (
          <div className="text-sm text-muted-foreground break-words">{stack}</div>
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
