import { Button, Pet, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { RefreshCw, Sunrise } from "lucide-react";

export function DiscoverIdlePane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Pet size={96} placement="top" href={null} showNudges={false} label="Poly" />
      <p className="max-w-xs text-sm text-muted-foreground">
        Your edition lands here once Poly has written it.
      </p>
    </div>
  );
}

export function DiscoverPreparing() {
  return (
    <div className="flex flex-col gap-7" aria-busy="true">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-elevated p-5">
        <p className="font-display text-2xl font-medium text-foreground">Out gathering</p>
        <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
          Poly is reading the news on your topics. A minute or two, usually.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="absolute right-2 bottom-0">
          <Pet size={80} placement="top" href={null} showNudges={false} label="Poly" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="aspect-[4/5] rounded-2xl" />
        <Skeleton className="aspect-[4/5] rounded-2xl" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}

export function DiscoverTurnOn({
  isWorking,
  onTurnOn,
}: {
  isWorking: boolean;
  onTurnOn: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface-elevated p-5">
      <p className="font-display text-2xl font-medium text-foreground">Make this yours</p>
      <p className="text-sm text-muted-foreground">
        Turn on Discover and each morning Poly writes an edition from your own chats: a brief,
        topics worth a look, links and things to do next.
      </p>
      <Button size="sm" variant="primary" disabled={isWorking} onClick={onTurnOn}>
        <Sunrise size={14} aria-hidden />
        {isWorking ? "Setting up your first edition" : "Turn on Discover"}
      </Button>
    </div>
  );
}

export function DiscoverNoEdition({
  isRefreshing,
  onWriteNow,
}: {
  isRefreshing: boolean;
  onWriteNow: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface-elevated p-5">
      <p className="font-display text-2xl font-medium text-foreground">Nothing yet</p>
      <p className="text-sm text-muted-foreground">
        Your first edition arrives tomorrow at seven. Or Poly can write one now.
      </p>
      <Button size="sm" variant="primary" disabled={isRefreshing} onClick={onWriteNow}>
        <RefreshCw size={14} aria-hidden />
        Write today's edition
      </Button>
    </div>
  );
}
