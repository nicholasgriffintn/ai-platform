import type {
  DesktopEndpoint,
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
  ModelRuntimeVendor,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type FormEvent, useState } from "react";

import {
  buildCustomRuntimeCandidate,
  readinessDetail,
  validateRuntimeCandidate,
} from "./runtime-candidates";
import type { RuntimeSettingsProps } from "./RuntimeSettings";
interface RuntimeConnectOutcome {
  ok: boolean;
  message?: string;
}
export function useRuntimeSettings({
  endpoints,
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
      const message = getErrorMessage(error, "The runtime action did not finish.");

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
      setErrorsById((current) => ({
        ...current,
        [endpoint.id]: getErrorMessage(error, "The runtime action did not finish."),
      }));
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
      setErrorsById((current) => ({
        ...current,
        [endpoint.id]: getErrorMessage(error, "The runtime action did not finish."),
      }));
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

  return {
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
  };
}
