import {
  ButtonLink,
  Card,
  PageStatus,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import type { SharedOutput } from "@ngriffin_uk/polychat-schemas";
import { FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { OutputContent } from "~/components/Experiences/OutputContent";
import { API_BASE_URL } from "~/constants";
import { getSharedOutput } from "~/lib/api/outputs";

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

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");

      return;
    }

    getSharedOutput(token)
      .then(setOutput)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "This output is unavailable");
      });
  }, [token]);

  if (error) {
    return (
      <PageShell title="Shared output unavailable" displayNavBar={false}>
        <PageStatus message={error}>
          <ButtonLink variant="outline" href="/">
            Return home
          </ButtonLink>
        </PageStatus>
      </PageShell>
    );
  }

  if (!output || !token) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center" displayNavBar={false}>
        <Loader2 size={40} className="animate-spin text-zinc-400" />
      </PageShell>
    );
  }

  return (
    <PageShell title={output.title} displayNavBar={false}>
      <div className="mx-auto w-full max-w-4xl py-8">
        <Card className="gap-5 p-6 shadow-none">
          <div className="flex items-center gap-3">
            <FileQuestion size={20} className="text-zinc-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {output.capabilityId}
              </p>
              <h1 className="text-xl font-semibold">{output.title}</h1>
            </div>
          </div>
          {output.file ? (
            <a
              href={`${API_BASE_URL}/outputs/shared/${encodeURIComponent(token)}/content`}
              target="_blank"
              rel="noreferrer"
              className={textLinkClassName({ tone: "accent" })}
            >
              Open {output.file.filename || "shared file"}
            </a>
          ) : null}
          <OutputContent
            capabilityId={output.capabilityId}
            content={output.content}
            kind={output.kind}
          />
        </Card>
      </div>
    </PageShell>
  );
}
