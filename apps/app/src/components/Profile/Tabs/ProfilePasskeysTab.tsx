import { PasskeyList } from "@ngriffin_uk/polychat-component-account";
import { KeyRound } from "lucide-react";
import { useEffect } from "react";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import { useTrackEvent } from "~/hooks/use-track-event";
import { usePasskeys } from "~/hooks/usePasskeys";

export function ProfilePasskeysTab() {
  const { trackEvent } = useTrackEvent();

  const {
    passkeys,
    fetchPasskeys,
    isLoadingPasskeys,
    registerPasskey,
    isRegisteringPasskey,
    deletePasskey,
    isDeletingPasskey,
    isPasskeySupported,
  } = usePasskeys();

  const passkeySupported = isPasskeySupported();

  useEffect(() => {
    void fetchPasskeys();
  }, [fetchPasskeys]);

  const handleAddPasskey = () => {
    trackEvent({
      name: "add_passkey",
      category: "profile",
      label: "add_passkey",
      value: 1,
    });
    registerPasskey();
  };

  return (
    <ProfileTab
      title="Passkeys"
      actions={
        passkeySupported
          ? [
              {
                label: isRegisteringPasskey ? "Adding..." : "Add Passkey",
                onClick: handleAddPasskey,
                disabled: isRegisteringPasskey,
                icon: <KeyRound className="h-4 w-4 mr-2" />,
              },
            ]
          : []
      }
    >
      <PasskeyList
        passkeys={passkeys}
        isSupported={passkeySupported}
        isLoading={isLoadingPasskeys}
        isRegistering={isRegisteringPasskey}
        isDeleting={isDeletingPasskey}
        onRegister={handleAddPasskey}
        onDelete={deletePasskey}
      />
    </ProfileTab>
  );
}
