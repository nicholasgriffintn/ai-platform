import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  DesktopEndpoint,
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { CircleX, PlugZap, RefreshCcw, Server, Trash2 } from "lucide-react";

import { readinessDetail, readinessLabel, runtimeVendorLabel } from "./runtime-candidates";

function readinessVariant(
  readiness: DesktopRuntimeReadiness,
): "success" | "warning" | "destructive" {
  switch (readiness.status) {
    case "ready":
      return "success";
    case "unauthorised":
      return "warning";
    case "unreachable":
      return "destructive";
  }

  return "destructive";
}

function RuntimeReadiness({ readiness }: { readiness: DesktopRuntimeReadiness }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={readinessVariant(readiness)}>{readinessLabel(readiness)}</Badge>
        <span className="text-xs text-muted-foreground">
          Checked {formatRelativeTime(readiness.checkedAt)}
        </span>
      </div>
      {readiness.status !== "ready" && (
        <p className="text-sm text-muted-foreground">{readinessDetail(readiness)}</p>
      )}
    </div>
  );
}

export function RuntimeRow({
  endpoint,
  readiness,
  error,
  isPending,
  onProbe,
  onForget,
}: {
  endpoint: DesktopEndpoint;
  readiness?: DesktopRuntimeReadiness;
  error?: string;
  isPending: boolean;
  onProbe: () => void;
  onForget: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">{endpoint.label}</p>
            <p className="text-sm text-muted-foreground">
              {runtimeVendorLabel(endpoint.vendor)} · {endpoint.url}
            </p>
            <p className="text-xs text-muted-foreground">
              Added {formatRelativeTime(endpoint.approvedAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<RefreshCcw className="h-4 w-4" />}
            isLoading={isPending}
            onClick={onProbe}
          >
            Check
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            disabled={isPending}
            onClick={onForget}
          >
            Forget
          </Button>
        </div>
      </div>
      {readiness ? (
        <RuntimeReadiness readiness={readiness} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Saved locally. Check the runtime when you want to confirm it is running.
        </p>
      )}
      {error ? (
        <Alert variant="destructive">
          <CircleX aria-hidden="true" />
          <AlertTitle>Runtime action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function CandidateRow({
  candidate,
  description,
  isPending,
  readiness,
  error,
  onConnect,
}: {
  candidate: DesktopEndpointCandidate;
  description: string;
  isPending: boolean;
  readiness?: DesktopRuntimeReadiness;
  error?: string;
  onConnect: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">{candidate.label}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground">{candidate.url}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          icon={<PlugZap className="h-4 w-4" />}
          isLoading={isPending}
          onClick={onConnect}
        >
          Connect
        </Button>
      </div>
      {readiness ? <RuntimeReadiness readiness={readiness} /> : null}
      {error ? (
        <Alert variant="destructive">
          <CircleX aria-hidden="true" />
          <AlertTitle>Could not connect</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
