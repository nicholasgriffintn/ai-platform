import {
  Badge,
  Button,
  FormDialog,
  FormInput,
  FormSelect,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import {
  HUGGINGFACE_ENDPOINT_LOCATIONS,
  type HuggingFaceConnection,
  type HuggingFaceTokenCheck,
  type SaveHuggingFaceConnectionRequest,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { RegistryPanel } from "./RegistryPanel";

const TOKENS_URL = "https://huggingface.co/settings/tokens";

const LOCATION_OPTIONS = HUGGINGFACE_ENDPOINT_LOCATIONS.map((location) => ({
  value: `${location.vendor}:${location.region}`,
  label: location.label,
}));

export interface HuggingFaceConnectionCardProps {
  connection: HuggingFaceConnection;
  isSaving: boolean;
  isDisconnecting: boolean;
  onCheck: (token?: string) => Promise<HuggingFaceTokenCheck>;
  onSave: (input: SaveHuggingFaceConnectionRequest) => Promise<void>;
  onDisconnect: () => void;
}

function locationLabel(connection: HuggingFaceConnection): string {
  return (
    HUGGINGFACE_ENDPOINT_LOCATIONS.find(
      (location) =>
        location.vendor === connection.endpointVendor &&
        location.region === connection.endpointRegion,
    )?.label ?? `${connection.endpointVendor} ${connection.endpointRegion}`
  );
}

function describe(connection: HuggingFaceConnection): string {
  if (connection.source === "workspace") {
    return `Signed in as ${connection.account ?? "unknown"}. Fine-tunes publish to ${connection.organisation ?? connection.account ?? "that account"} and endpoints run in ${locationLabel(connection)}.`;
  }

  if (connection.source === "platform") {
    return "Using the platform's shared token. Connect your own to train and deploy under your organisation and bill it there.";
  }

  return "Not connected. Public models and datasets work without it; gated repos, fine-tuning and dedicated endpoints need a token.";
}

function defaultOrganisation(identity: HuggingFaceTokenCheck, current: string | null): string {
  const names = [identity.account, ...identity.organisations.map((org) => org.name)];

  if (current && names.includes(current)) {
    return current;
  }

  return identity.organisations.find((org) => org.canWrite)?.name ?? identity.account;
}

export function HuggingFaceWriteHint({ action }: { action: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      {action} runs under your Hugging Face organisation. A workspace admin can connect one with
      write access under Govern.
    </p>
  );
}

export function HuggingFaceConnectionCard({
  connection,
  isSaving,
  isDisconnecting,
  onCheck,
  onSave,
  onDisconnect,
}: HuggingFaceConnectionCardProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [identity, setIdentity] = useState<HuggingFaceTokenCheck | null>(null);
  const [organisation, setOrganisation] = useState("");
  const [location, setLocation] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const connected = connection.source === "workspace";

  const check = async (candidate?: string) => {
    setIsChecking(true);
    setCheckError(null);

    try {
      const result = await onCheck(candidate);

      setIdentity(result);
      setOrganisation(defaultOrganisation(result, connection.organisation));
    } catch (error) {
      setIdentity(null);
      setCheckError(getErrorMessage(error, "That token did not work"));
    } finally {
      setIsChecking(false);
    }
  };

  const openDialog = (reuseToken: boolean) => {
    setToken("");
    setIdentity(null);
    setCheckError(null);
    setLocation(`${connection.endpointVendor}:${connection.endpointRegion}`);
    setOpen(true);

    if (reuseToken) {
      void check();
    }
  };

  const save = async () => {
    if (!identity) {
      return;
    }

    const [endpointVendor = "", endpointRegion = ""] = location.split(":");

    await onSave({
      token: token.trim() || undefined,
      organisation: organisation === identity.account ? null : organisation,
      endpointVendor,
      endpointRegion,
    });
    setOpen(false);
  };

  const organisationOptions = identity
    ? [
        {
          value: identity.account,
          label: `${identity.account} (personal)${identity.canWrite ? "" : " · read only"}`,
        },
        ...identity.organisations.map((org) => ({
          value: org.name,
          label: `${org.name}${org.canWrite ? "" : " · read only"}`,
        })),
      ]
    : [];
  const chosenCanWrite = identity
    ? organisation === identity.account
      ? identity.canWrite
      : Boolean(identity.organisations.find((org) => org.name === organisation)?.canWrite)
    : false;

  return (
    <RegistryPanel>
      <div className="space-y-2">
        <Badge variant={connection.canTrainAndDeploy ? "success" : "outline"}>
          {connection.canTrainAndDeploy ? "Can train and deploy" : "Search and import only"}
        </Badge>
        <p className="text-sm text-muted-foreground">{describe(connection)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button size="sm" variant="outline" onClick={() => openDialog(true)}>
              Change settings
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog(false)}>
              Replace token
            </Button>
            <Button size="sm" variant="ghost" disabled={isDisconnecting} onClick={onDisconnect}>
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={() => openDialog(false)}>
            Connect Hugging Face
          </Button>
        )}
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Connect Hugging Face"
        description="The token is encrypted at rest and never shown again. Fine-tunes and endpoints are created and billed under the account you pick."
        submitText="Save connection"
        isLoading={isSaving}
        submitDisabled={!identity || !organisation || !location || isChecking}
        onSubmit={save}
      >
        {(!connected || token || !identity) && (
          <div className="space-y-2">
            <FormInput
              label="Access token"
              type="password"
              autoComplete="off"
              placeholder={connected ? "Leave blank to keep the saved token" : "hf_…"}
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                setIdentity(null);
              }}
              onBlur={() => {
                if (token.trim()) {
                  void check(token.trim());
                }
              }}
              description="Use a write token, or a fine-grained token with write access to the organisation's repos and Inference Endpoints."
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isChecking || (!token.trim() && !connected)}
                onClick={() => void check(token.trim() || undefined)}
              >
                {isChecking ? "Checking…" : "Check token"}
              </Button>
              <a
                href={TOKENS_URL}
                target="_blank"
                rel="noreferrer"
                className={textLinkClassName({ size: "xs" })}
              >
                Create a token
              </a>
            </div>
          </div>
        )}
        {checkError && <p className="text-sm text-failure">{checkError}</p>}
        {identity && (
          <>
            <FormSelect
              label="Publish and bill under"
              options={organisationOptions}
              value={organisation}
              onValueChange={setOrganisation}
            />
            {!chosenCanWrite && (
              <p className="text-xs text-muted-foreground">
                This token cannot write there, so search and import will work but fine-tuning and
                deployment stay off.
              </p>
            )}
            <FormSelect
              label="Endpoint location"
              options={LOCATION_OPTIONS}
              value={location}
              onValueChange={setLocation}
            />
          </>
        )}
      </FormDialog>
    </RegistryPanel>
  );
}
