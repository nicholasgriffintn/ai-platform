import { Fingerprint, KeyRound, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { Skeleton } from "~/components/ui/Skeleton";
import { usePasskeys } from "~/hooks/usePasskeys";
import { formatRelativeTime } from "~/lib/dates";
import { PageHeader } from "../../PageHeader";
import { PageTitle } from "../../PageTitle";

export function ProfilePasskeysTab() {
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

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [selectedPasskeyId, setSelectedPasskeyId] = useState<number | null>(
    null,
  );

  const passkeySupported = isPasskeySupported();

  useEffect(() => {
    void fetchPasskeys();
  }, [fetchPasskeys]);

  const handleAddPasskey = () => {
    registerPasskey();
  };

  const openDeleteConfirmation = (passkeyId: number) => {
    setSelectedPasskeyId(passkeyId);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeletePasskey = () => {
    if (selectedPasskeyId !== null) {
      deletePasskey(selectedPasskeyId);
      setIsConfirmDeleteOpen(false);
    }
  };

  return (
    <div>
      <PageHeader
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
        <PageTitle title="Passkeys" />
      </PageHeader>

      {!passkeySupported ? (
        <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-amber-800 dark:text-amber-300 font-medium">
                Passkeys not supported
              </h3>
              <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                Your browser doesn't support passkeys. Try using a newer browser
                like Chrome, Safari, or Edge.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {isLoadingPasskeys ? (
            <div className="space-y-4">
              {[1, 2].map((num) => (
                <Card key={`skeleton-${num}`} className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </Card>
              ))}
            </div>
          ) : passkeys.length === 0 ? (
            <Card className="p-6">
              <div className="text-center py-6">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                  <Fingerprint className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
                </div>
                <h3 className="text-zinc-900 dark:text-zinc-100 font-medium">
                  No passkeys added
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 max-w-sm mx-auto">
                  Add a passkey to sign in to your account without a password.
                  Passkeys use biometrics or device PIN for secure
                  authentication.
                </p>
                <Button
                  variant="primary"
                  onClick={handleAddPasskey}
                  disabled={isRegisteringPasskey}
                  className="mt-4"
                  icon={<KeyRound className="h-4 w-4 mr-2" />}
                >
                  {isRegisteringPasskey ? "Adding..." : "Add Passkey"}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
                Passkeys allow you to sign in to your account using biometrics
                (like fingerprint or face recognition) or your device PIN
                instead of a password.
              </p>
              {passkeys.map((passkey) => (
                <Card key={`passkey-${passkey.id}`} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <Fingerprint className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                          {passkey.device_type} Passkey
                        </h3>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Added {formatRelativeTime(passkey.created_at)}
                        {passkey.backed_up && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                            <Shield className="h-3 w-3 mr-1" /> Synced
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirmation(passkey.id)}
                      disabled={isDeletingPasskey}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Passkey</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-500 dark:text-zinc-400">
              Are you sure you want to remove this passkey? You won't be able to
              use it to sign in anymore.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePasskey}
              disabled={isDeletingPasskey}
            >
              {isDeletingPasskey ? "Removing..." : "Remove Passkey"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
