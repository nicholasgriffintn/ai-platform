import {
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  HoverActions,
  ListItem,
  Skeleton,
} from "@ngriffin_uk/polychat-component-ui";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Fingerprint, KeyRound, Shield, Trash2 } from "lucide-react";
import { useState } from "react";

export interface Passkey {
  id: number;
  device_type: string;
  created_at: string;
  backed_up?: boolean;
}

export interface PasskeyListProps {
  passkeys: Passkey[];
  isSupported: boolean;
  isLoading?: boolean;
  isRegistering?: boolean;
  isDeleting?: boolean;
  onRegister: () => void;
  onDelete: (passkeyId: number) => void;
}

function UnsupportedNotice() {
  return (
    <Card className="border-attention/45 bg-attention/12 p-5">
      <div className="flex">
        <Shield className="mr-3 h-5 w-5 flex-shrink-0 text-attention" />
        <div>
          <h3 className="font-medium text-attention">Passkeys not supported</h3>
          <p className="mt-1 text-sm text-attention">
            Your browser doesn't support passkeys. Try using a newer browser like Chrome, Safari, or
            Edge.
          </p>
        </div>
      </div>
    </Card>
  );
}

export function PasskeyList({
  passkeys,
  isSupported,
  isLoading = false,
  isRegistering = false,
  isDeleting = false,
  onRegister,
  onDelete,
}: PasskeyListProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  if (!isSupported) {
    return <UnsupportedNotice />;
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((num) => (
            <Card key={`skeleton-${num}`} className="p-4">
              <div className="flex items-center justify-between">
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
        <EmptyState
          icon={<Fingerprint className="h-6 w-6 text-muted-foreground" />}
          title="No passkeys added"
          message="Add a passkey to sign in to your account without a password. Passkeys use biometrics or device PIN for secure authentication."
          action={
            <Button
              variant="primary"
              onClick={onRegister}
              disabled={isRegistering}
              icon={<KeyRound className="mr-2 h-4 w-4" />}
            >
              {isRegistering ? "Adding..." : "Add Passkey"}
            </Button>
          }
          className="bg-transparent p-6 dark:bg-transparent"
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Passkeys allow you to sign in to your account using biometrics (like fingerprint or face
            recognition) or your device PIN instead of a password.
          </p>
          <ul className="space-y-1">
            {passkeys.map((passkey) => (
              <ListItem
                key={`passkey-${passkey.id}`}
                icon={<Fingerprint size={16} />}
                label={`${passkey.device_type} Passkey`}
                sublabel={`Added ${formatRelativeTime(passkey.created_at)}`}
                badge={
                  passkey.backed_up ? (
                    <span className="inline-flex items-center rounded-full bg-success/12 px-2 py-0.5 text-xs text-success">
                      <Shield className="mr-1 h-3 w-3" /> Synced
                    </span>
                  ) : undefined
                }
                actions={
                  <HoverActions
                    actions={[
                      {
                        id: "delete",
                        icon: <Trash2 size={14} />,
                        label: "Remove passkey",
                        onClick: (event) => {
                          event.stopPropagation();
                          setConfirmingId(passkey.id);
                        },
                        disabled: isDeleting,
                      },
                    ]}
                  />
                }
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmationDialog
        open={confirmingId !== null}
        onOpenChange={(open) => !open && setConfirmingId(null)}
        title="Remove Passkey"
        description="Are you sure you want to remove this passkey? You won't be able to use it to sign in anymore."
        confirmText="Remove Passkey"
        variant="destructive"
        onConfirm={() => {
          if (confirmingId !== null) {
            onDelete(confirmingId);
          }

          setConfirmingId(null);
        }}
        isLoading={isDeleting}
      />
    </div>
  );
}
