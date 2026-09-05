import type {
  ProjectWorkbenchPreviewDisplayState,
  ProjectWorkbenchServiceItem,
} from "@ngriffin_uk/polychat-component-workspaces";
import type { SandboxPreviewAccess } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { createSandboxPreview, fetchSandboxPreview, revokeSandboxPreview } from "~/lib/api/sandbox";

const ACTIVE_REFRESH_MS = 2_000;

function accessIsExpired(access?: SandboxPreviewAccess): boolean {
  return Boolean(access && Date.parse(access.expiresAt) <= Date.now());
}

function displayState(
  service: ProjectWorkbenchServiceItem | undefined,
  access: SandboxPreviewAccess | undefined,
  isLoading: boolean,
): ProjectWorkbenchPreviewDisplayState {
  if (isLoading) {
    return "loading";
  }

  if (!service || service.status === "stopped") {
    return "stopped";
  }

  if (
    service.status === "starting" ||
    service.status === "running" ||
    service.status === "restarting"
  ) {
    return "starting";
  }

  if (
    service.status === "unhealthy" ||
    service.status === "failed" ||
    service.status === "timed_out"
  ) {
    return "unhealthy";
  }

  if (!access) {
    return "stopped";
  }

  return accessIsExpired(access) ? "expired" : access.state;
}

export function useProjectWorkbenchPreview({
  runId,
  services,
  isRunLoading,
}: {
  runId?: string;
  services: ProjectWorkbenchServiceItem[];
  isRunLoading: boolean;
}) {
  const [preferredServiceName, setPreferredServiceName] = useState<string>();
  const [localAccess, setLocalAccess] = useState<SandboxPreviewAccess>();
  const selectedService =
    services.find((service) => service.name === preferredServiceName) ?? services[0];
  const scopedAccess =
    localAccess && localAccess.runId === runId && localAccess.serviceName === selectedService?.name
      ? localAccess
      : undefined;
  const accessQuery = useQuery({
    queryKey: ["project-workbench-preview", runId, scopedAccess?.previewId],
    queryFn: async () => {
      if (!runId || !scopedAccess) {
        throw new Error("No preview access is selected");
      }

      const restored = await fetchSandboxPreview(runId, scopedAccess.previewId);

      return { ...restored, url: scopedAccess.url };
    },
    enabled: Boolean(runId && scopedAccess),
    initialData: scopedAccess,
    refetchInterval: (query) =>
      query.state.data?.state === "healthy" || query.state.data?.state === "starting"
        ? ACTIVE_REFRESH_MS
        : false,
    refetchIntervalInBackground: true,
  });
  const preview = accessQuery.data ?? scopedAccess;
  const createMutation = useMutation({
    mutationFn: async ({ replaceCurrent }: { replaceCurrent: boolean }) => {
      if (!runId || !selectedService) {
        throw new Error("No previewable service is selected");
      }

      const access = await createSandboxPreview(runId, { serviceName: selectedService.name });

      if (replaceCurrent) {
        setLocalAccess(access);
      }

      return access;
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!runId || !preview) {
        return;
      }

      await revokeSandboxPreview(runId, preview.previewId);
    },
    onSuccess: () => setLocalAccess(undefined),
  });
  const state = displayState(selectedService, preview, isRunLoading);
  const canCreate = Boolean(
    runId && selectedService?.expectedPort && selectedService.status === "healthy",
  );
  const disabledReason = !selectedService
    ? "This run has no declared network service."
    : !selectedService.expectedPort
      ? "This service does not declare a preview port."
      : selectedService.status === "healthy" && !preview
        ? "The service is healthy and ready for short-lived preview access."
        : undefined;

  return {
    selectedServiceName: selectedService?.name,
    preview,
    state,
    canCreate,
    disabledReason,
    isCreating: createMutation.isPending,
    isRevoking: revokeMutation.isPending,
    error: createMutation.error ?? revokeMutation.error ?? accessQuery.error,
    setSelectedServiceName: setPreferredServiceName,
    create: async () => {
      await createMutation.mutateAsync({ replaceCurrent: true });
    },
    refresh: async () => {
      if (runId && preview) {
        await revokeSandboxPreview(runId, preview.previewId);
        setLocalAccess(undefined);
      }

      await createMutation.mutateAsync({ replaceCurrent: true });
    },
    openExternal: async () => {
      const access = await createMutation.mutateAsync({ replaceCurrent: false });

      if (!access.url) {
        throw new Error("Preview access did not return an opening URL");
      }

      return access.url;
    },
    revoke: async () => {
      await revokeMutation.mutateAsync();
    },
  };
}
