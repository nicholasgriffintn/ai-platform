import {
  EnterpriseSignInForm,
  LinkedEnterpriseIdentities,
} from "@ngriffin_uk/polychat-component-account";
import { enterpriseIdentityUrls } from "@ngriffin_uk/polychat-library-client";
import { useLinkedEnterpriseIdentities } from "@ngriffin_uk/polychat-library-react";

import { useShellHost } from "../Host/ShellHostContext.js";

export function EnterpriseIdentities() {
  const query = useLinkedEnterpriseIdentities();
  const host = useShellHost();
  const signIn = (id: string, link: boolean) => {
    if (host.openEnterpriseSignIn) {
      host.openEnterpriseSignIn(id, link);

      return;
    }

    const urls = enterpriseIdentityUrls(id);

    window.location.href = link ? urls.link : urls.signIn;
  };

  return (
    <div className="mt-8 space-y-5">
      <LinkedEnterpriseIdentities
        identities={query.data?.identities ?? []}
        isLoading={query.isLoading}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        onRefresh={(id) => signIn(id, false)}
      />
      <EnterpriseSignInForm onSignIn={(id) => signIn(id, true)} />
      <p className="text-xs text-muted-foreground">
        Linking requires an existing Polychat sign-in in the browser used for company sign-in. Email
        addresses alone never link accounts.
      </p>
    </div>
  );
}
