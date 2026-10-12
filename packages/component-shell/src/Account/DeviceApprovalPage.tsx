import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import { normaliseDeviceUserCode } from "@ngriffin_uk/polychat-schemas";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { useShellHost } from "../Host/ShellHostContext.js";
import { PageShell } from "../Shell/PageShell.js";
import { DeviceCodeEntry } from "./Device/DeviceCodeEntry.js";
import { DeviceDecision } from "./Device/DeviceDecision.js";
import { DevicePairingCard } from "./Device/DevicePairingCard.js";

export function DeviceApprovalPage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const { openSignIn } = useShellHost();
  const [searchParams] = useSearchParams();
  const linkedCode = normaliseDeviceUserCode(searchParams.get("user_code") ?? "");
  const [userCode, setUserCode] = useState<string | null>(linkedCode);

  return (
    <PageShell
      title="Connect a device"
      displayNavBar={false}
      className="max-w-2xl"
      headerTitleAs="span"
    >
      {isLoading ? (
        <DevicePairingCard state="waiting" eyebrow="Connect a device" title="Checking your sign-in">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-active-work" aria-hidden="true" />
        </DevicePairingCard>
      ) : !isAuthenticated ? (
        <DevicePairingCard
          state="waiting"
          eyebrow="Connect a device"
          title="Sign in to approve this device"
          description="The device is waiting for someone to vouch for it. Sign in first, then check its code."
        >
          <Button variant="primary" size="lg" fullWidth onClick={openSignIn}>
            Sign in
          </Button>
        </DevicePairingCard>
      ) : userCode ? (
        <DeviceDecision userCode={userCode} onReset={() => setUserCode(null)} />
      ) : (
        <DeviceCodeEntry onSubmit={setUserCode} />
      )}
    </PageShell>
  );
}
