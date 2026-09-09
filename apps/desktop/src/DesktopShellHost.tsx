import type { ModelSource, ModelSourceReadiness } from "@ngriffin_uk/polychat-component-models";
import {
  DeviceTaskNotificationSettings,
  ShellDialogs,
  type ShellHost,
  ShellHostProvider,
} from "@ngriffin_uk/polychat-component-shell";
import { WEB_APP_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import { useUIStore, useRuntimeEndpoints } from "@ngriffin_uk/polychat-library-react";
import type { DesktopEndpointCandidate, ModelRuntimeVendor } from "@ngriffin_uk/polychat-schemas";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type DesktopModelSourceVendor = Extract<ModelRuntimeVendor, "ollama" | "lmstudio">;

const DESKTOP_MODEL_RUNTIME_CANDIDATES: Record<DesktopModelSourceVendor, DesktopEndpointCandidate> =
  {
    ollama: {
      id: "ollama-loopback",
      kind: "model",
      vendor: "ollama",
      label: "Ollama",
      url: "http://127.0.0.1:11434",
      transport: "loopback",
    },
    lmstudio: {
      id: "lmstudio-loopback",
      kind: "model",
      vendor: "lmstudio",
      label: "LM Studio",
      url: "http://127.0.0.1:1234",
      transport: "loopback",
    },
  };

export function DesktopShellHost({
  children,
  onSignIn,
  onSignOut,
}: {
  children: ReactNode;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);
  const navigate = useNavigate();
  const { connect } = useRuntimeEndpoints();
  const [runtimeReadiness, setRuntimeReadiness] = useState<
    Record<DesktopModelSourceVendor, ModelSourceReadiness>
  >({
    ollama: "not-connected",
    lmstudio: "not-connected",
  });

  const connectRuntime = useCallback(
    async (vendor: DesktopModelSourceVendor) => {
      try {
        const result = await connect.mutateAsync(DESKTOP_MODEL_RUNTIME_CANDIDATES[vendor]);

        if (!result.ok) {
          toast.error(
            result.readiness.detail ??
              `${DESKTOP_MODEL_RUNTIME_CANDIDATES[vendor].label} is not running.`,
          );

          return;
        }

        setRuntimeReadiness((current) => ({ ...current, [vendor]: "ready" }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not connect this runtime.");
      }
    },
    [connect],
  );

  const modelSourceRows = useMemo<readonly ModelSource[]>(
    () =>
      (Object.keys(DESKTOP_MODEL_RUNTIME_CANDIDATES) as DesktopModelSourceVendor[]).map(
        (vendor) => {
          const readiness = runtimeReadiness[vendor];
          const label = DESKTOP_MODEL_RUNTIME_CANDIDATES[vendor].label;

          return {
            id: `desktop-${vendor}`,
            name: `This Mac · ${label}`,
            detail: readiness === "ready" ? "Ready" : "Not connected",
            readiness,
            action: {
              label: readiness === "ready" ? "Reconnect" : "Connect",
              onSelect: () => connectRuntime(vendor),
            },
          };
        },
      ),
    [connectRuntime, runtimeReadiness],
  );

  const host = useMemo<ShellHost>(
    () => ({
      webBaseUrl: WEB_APP_BASE_URL,
      openAssistant: () => setShowMetaAssistant(true),
      openSignIn: onSignIn,
      signOut: onSignOut,
      TaskNotificationSettings: DeviceTaskNotificationSettings,
      HostDialogs: ShellDialogs,
      modelSourceSurface: "desktop",
      modelSourceRows,
      openProviderSettings: () => void navigate("/profile?tab=providers"),
    }),
    [modelSourceRows, navigate, onSignIn, onSignOut, setShowMetaAssistant],
  );

  return <ShellHostProvider host={host}>{children}</ShellHostProvider>;
}
