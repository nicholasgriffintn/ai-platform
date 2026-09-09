import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  EmptyState,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  DesktopEndpoint,
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { CircleX, Loader2, PlugZap, Server } from "lucide-react";

import { SettingsSection } from "../SettingsSection";
import { KNOWN_RUNTIME_CANDIDATES, RUNTIME_VENDOR_OPTIONS } from "./runtime-candidates";
import { RuntimeRow, CandidateRow } from "./RuntimeRows";
import { useRuntimeSettings } from "./useRuntimeSettings";

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

export function RuntimeSettings({
  endpoints,
  isLoading = false,
  loadError,
  onConnect,
  onProbe,
  onForget,
}: RuntimeSettingsProps) {
  const {
    pendingId,
    readinessById,
    errorsById,
    vendor,
    setVendor,
    label,
    setLabel,
    url,
    setUrl,
    transport,
    setTransport,
    customError,
    savedIds,
    runConnect,
    runProbe,
    runForget,
    handleCustomSubmit,
  } = useRuntimeSettings({ endpoints, onConnect, onProbe, onForget });

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
            <AlertDescription>
              {getErrorMessage(loadError, "Could not load runtimes.")}
            </AlertDescription>
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
              onValueChange={setVendor}
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
          <FormSelect<"loopback" | "network">
            label="Location"
            value={transport}
            options={[
              { value: "loopback", label: "This machine (loopback)" },
              { value: "network", label: "Another machine (network)" },
            ]}
            onValueChange={setTransport}
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
    </div>
  );
}
