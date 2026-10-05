import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type { LinkedOidcIdentity } from "@ngriffin_uk/polychat-schemas";

export function LinkedEnterpriseIdentities({
  identities,
  isLoading,
  error,
  onRefresh,
  onRetry,
}: {
  identities: LinkedOidcIdentity[];
  isLoading: boolean;
  error?: string;
  onRefresh: (connectionId: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Company access</h2>
      <p className="text-sm text-muted-foreground">
        Sign in through a linked company identity provider. Your workspace roles stay managed in
        Polychat.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading linked identities…</p>
      ) : error ? (
        <div role="alert" className="space-y-3 text-sm text-failure">
          <p>{error}</p>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      ) : identities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No company identity linked yet. Use your workspace owner's sign-in link to connect one.
        </p>
      ) : (
        <Card className="divide-y divide-border py-0 shadow-none">
          {identities.map((identity) => (
            <div
              key={identity.connectionId}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{identity.workspaceName}</p>
                <p className="text-xs text-muted-foreground">
                  {identity.label} · {identity.enabled ? "Connected" : "Connection disabled"}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!identity.enabled}
                onClick={() => onRefresh(identity.connectionId)}
              >
                Sign in
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
