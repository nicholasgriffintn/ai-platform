import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  DesktopEndpoint,
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
  ModelRuntimeVendor,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { CircleCheck, CircleX, Loader2, PlugZap, RefreshCcw, Server, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { SettingsSection } from "../SettingsSection";
import {
  buildCustomRuntimeCandidate,
  KNOWN_RUNTIME_CANDIDATES,
  readinessDetail,
  readinessLabel,
  runtimeVendorLabel,
  RUNTIME_VENDOR_OPTIONS,
  validateRuntimeCandidate,
} from "./runtime-candidates";

export interface RuntimeConnectResult {
  ok: boolean;
  readiness: DesktopRuntimeReadiness;
}

export interface RuntimeSettingsProps {
  endpoints: DesktopEndpoint[];
  isLoading?: boolean;
  loadError?: unknown;
  onConnect: (candidate: DesktopEndpointCandidate) => Promise<RuntimeConnectResult>;
  onProbe: (endpoint: DesktopEndpoint) => Promise<DesktopRuntimeReadiness>;
  onForget: (endpointId: string) => Promise<void>;
}

interface RuntimeConnectOutcome {
  ok: boolean;
  message?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The runtime action did not finish.";
}

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

function RuntimeRow({
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

function CandidateRow({
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

export function RuntimeSettings({
  endpoints,
  isLoading = false,
  loadError,
  onConnect,
  onProbe,
  onForget,
}: RuntimeSettingsProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [readinessById, setReadinessById] = useState<Record<string, DesktopRuntimeReadiness>>({});
  const [errorsById, setErrorsById] = useState<Record<string, string>>({});
  const [vendor, setVendor] = useState<ModelRuntimeVendor>("ollama");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"loopback" | "network">("loopback");
  const [customError, setCustomError] = useState<string | null>(null);

  const savedIds = new Set(endpoints.map((endpoint) => endpoint.id));

  const runConnect = async (
    candidate: DesktopEndpointCandidate,
  ): Promise<RuntimeConnectOutcome> => {
    setPendingId(candidate.id);
    setErrorsById((current) => {
      const next = { ...current };

      delete next[candidate.id];

      return next;
    });

    try {
      const result = await onConnect(candidate);

      setReadinessById((current) => ({ ...current, [candidate.id]: result.readiness }));

      if (!result.ok) {
        const message = readinessDetail(result.readiness);

        setErrorsById((current) => ({
          ...current,
          [candidate.id]: message,
        }));

        return { ok: false, message };
      }

      return { ok: true };
    } catch (error) {
      const message = errorMessage(error);

      setErrorsById((current) => ({ ...current, [candidate.id]: message }));

      return { ok: false, message };
    } finally {
      setPendingId(null);
    }
  };

  const runProbe = async (endpoint: DesktopEndpoint) => {
    setPendingId(endpoint.id);
    setErrorsById((current) => {
      const next = { ...current };

      delete next[endpoint.id];

      return next;
    });

    try {
      const readiness = await onProbe(endpoint);

      setReadinessById((current) => ({ ...current, [endpoint.id]: readiness }));
    } catch (error) {
      setErrorsById((current) => ({ ...current, [endpoint.id]: errorMessage(error) }));
    } finally {
      setPendingId(null);
    }
  };

  const runForget = async (endpoint: DesktopEndpoint) => {
    setPendingId(endpoint.id);
    setErrorsById((current) => {
      const next = { ...current };

      delete next[endpoint.id];

      return next;
    });

    try {
      await onForget(endpoint.id);
      setReadinessById((current) => {
        const next = { ...current };

        delete next[endpoint.id];

        return next;
      });
    } catch (error) {
      setErrorsById((current) => ({ ...current, [endpoint.id]: errorMessage(error) }));
    } finally {
      setPendingId(null);
    }
  };

  const handleCustomSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = buildCustomRuntimeCandidate({ vendor, label, url, transport });
    const validationError = validateRuntimeCandidate(candidate);

    setCustomError(validationError);

    if (validationError) {
      return;
    }

    const result = await runConnect(candidate);

    setCustomError(result.ok ? null : (result.message ?? "Could not connect this runtime."));

    if (result.ok) {
      setLabel("");
      setUrl("");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Connected runtimes"
        description="Endpoints approved on this desktop. Polychat only contacts them when you ask it to check or discover models."
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading saved runtimes…
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <CircleX aria-hidden="true" />
            <AlertTitle>Unable to load runtimes</AlertTitle>
            <AlertDescription>{errorMessage(loadError)}</AlertDescription>
          </Alert>
        ) : endpoints.length === 0 ? (
          <EmptyState
            icon={<Server className="h-8 w-8 text-muted-foreground" />}
            title="No runtimes connected"
            message="Connect a local or network model runtime below to make its installed models available on this desktop."
            className="min-h-[220px] border-0 bg-transparent px-0 dark:bg-transparent"
          />
        ) : (
          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <RuntimeRow
                key={endpoint.id}
                endpoint={endpoint}
                readiness={readinessById[endpoint.id]}
                error={errorsById[endpoint.id]}
                isPending={pendingId === endpoint.id}
                onProbe={() => void runProbe(endpoint)}
                onForget={() => void runForget(endpoint)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Known runtimes"
        description="These local addresses are suggestions only. Nothing is contacted until you press Connect."
      >
        <div className="space-y-3">
          {KNOWN_RUNTIME_CANDIDATES.filter(({ candidate }) => !savedIds.has(candidate.id)).map(
            ({ candidate, description }) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                description={description}
                readiness={readinessById[candidate.id]}
                error={errorsById[candidate.id]}
                isPending={pendingId === candidate.id}
                onConnect={() => void runConnect(candidate)}
              />
            ),
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Custom model runtime"
        description="Enter an endpoint you control. Loopback addresses must resolve to this machine; network endpoints are never discovered automatically."
      >
        <form className="space-y-4" onSubmit={(event) => void handleCustomSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              label="Runtime"
              value={vendor}
              options={RUNTIME_VENDOR_OPTIONS}
              onChange={(event) => setVendor(event.target.value as ModelRuntimeVendor)}
            />
            <FormInput
              label="Label"
              value={label}
              placeholder="Home server"
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <FormInput
            label="Address"
            type="url"
            value={url}
            placeholder="http://127.0.0.1:11434"
            description="Use the runtime's base HTTP or HTTPS address without credentials in the URL."
            onChange={(event) => setUrl(event.target.value)}
          />
          <FormSelect
            label="Location"
            value={transport}
            options={[
              { value: "loopback", label: "This machine (loopback)" },
              { value: "network", label: "Another machine (network)" },
            ]}
            onChange={(event) => setTransport(event.target.value as "loopback" | "network")}
          />
          {customError ? (
            <Alert variant="destructive">
              <CircleX aria-hidden="true" />
              <AlertTitle>Check the runtime address</AlertTitle>
              <AlertDescription>{customError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              icon={<PlugZap className="h-4 w-4" />}
              isLoading={pendingId !== null}
            >
              Connect custom runtime
            </Button>
          </div>
        </form>
      </SettingsSection>

      <div className="flex items-start gap-2 rounded-lg border border-active-work/25 bg-active-work/10 p-4 text-sm text-muted-foreground">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-active-work" aria-hidden="true" />
        <p>
          Connecting first checks that the runtime answers. Failed checks do not create an endpoint
          or store a pairing secret.
        </p>
      </div>
    </div>
  );
}
