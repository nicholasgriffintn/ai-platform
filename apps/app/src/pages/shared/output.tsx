import {
  PageShell,
  readSharedSiteProject,
  SharedOutputViewer,
  SharedSite,
} from "@ngriffin_uk/polychat-component-shell";
import { ButtonLink, LoadingSpinner, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { API_BASE_URL, getSharedOutput } from "@ngriffin_uk/polychat-library-client";
import type { SharedOutput } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

export function meta() {
  return [
    { title: "Shared output - Polychat" },
    { name: "description", content: "An output shared from Polychat" },
  ];
}

export default function SharedOutputPage() {
  const { token } = useParams<{ token: string }>();
  const [output, setOutput] = useState<SharedOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const missingTokenError = token ? null : "Invalid share link";

  useEffect(() => {
    if (!token) {
      return;
    }

    getSharedOutput(token)
      .then(setOutput)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "This output is unavailable");
      });
  }, [token]);

  const displayError = error ?? missingTokenError;

  if (displayError) {
    return (
      <PageShell title="Shared output unavailable" displayNavBar={false}>
        <PageStatus message={displayError}>
          <ButtonLink variant="outline" href="/">
            Return home
          </ButtonLink>
        </PageStatus>
      </PageShell>
    );
  }

  if (!output || !token) {
    return (
      <PageShell title="Shared output" displayNavBar={false}>
        <LoadingSpinner message="Loading shared output..." className="py-16" />
      </PageShell>
    );
  }

  const sharedSite = readSharedSiteProject(output, token);

  if (sharedSite) {
    return (
      <PageShell title={output.title} displayNavBar={false}>
        <SharedSite project={sharedSite} />
      </PageShell>
    );
  }

  return (
    <PageShell title={output.title} displayNavBar={false} className="max-w-6xl">
      <SharedOutputViewer
        output={output}
        fileUrl={
          output.file
            ? `${API_BASE_URL}/outputs/shared/${encodeURIComponent(token)}/content`
            : undefined
        }
      />
    </PageShell>
  );
}
