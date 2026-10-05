import {
  createNativeMcpServerSchema,
  connectNativeMcpServerSchema,
  type CreateNativeMcpServer,
  type ConnectNativeMcpServer,
  type NativeMcpCredential,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useMcpServerForm(
  workspaceId: string | undefined,
  onCreate: (input: CreateNativeMcpServer) => Promise<void>,
) {
  const [label, setLabel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [error, setError] = useState<string>();
  const submit = async () => {
    const parsed = createNativeMcpServerSchema.safeParse({ label, endpoint, workspaceId });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);

      return;
    }

    try {
      await onCreate(parsed.data);
      setLabel("");
      setEndpoint("");
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to add server");
    }
  };

  return { label, setLabel, endpoint, setEndpoint, error, submit };
}

export function useMcpConnectionForm(
  sharedProjects: string[],
  onConnect: (input: ConnectNativeMcpServer) => Promise<void>,
) {
  const [type, setType] = useState<NativeMcpCredential["type"]>("none");
  const [value, setValue] = useState("");
  const [endpointConsent, setEndpointConsent] = useState(false);
  const [sharedProjectIds, setSharedProjectIds] = useState(sharedProjects);
  const [error, setError] = useState<string>();
  const submit = async () => {
    const parsed = connectNativeMcpServerSchema.safeParse({
      endpointConsent,
      credential: type === "none" ? { type } : { type, value },
      sharedProjectIds,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);

      return;
    }

    try {
      await onConnect(parsed.data);
      setValue("");
      setEndpointConsent(false);
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to connect");
    }
  };

  return {
    type,
    setType,
    value,
    setValue,
    endpointConsent,
    setEndpointConsent,
    sharedProjectIds,
    setSharedProjectIds,
    error,
    submit,
  };
}
