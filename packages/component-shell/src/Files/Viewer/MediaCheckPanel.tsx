import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  describeMediaCheck,
  type MediaCheckResult,
  useMediaCheck,
} from "@ngriffin_uk/polychat-library-react";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export function MediaCheckResultCard({ result }: { result: MediaCheckResult }) {
  const { title, detail } = describeMediaCheck(result);
  const entry = result.kind === "found" ? result.entry : null;

  return (
    <section
      aria-label="File check result"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground">{detail}</p>
      {entry ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {entry.model ? (
            <>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate text-foreground">{entry.model}</dd>
            </>
          ) : null}
          {entry.provider ? (
            <>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="truncate text-foreground">{entry.provider}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Recorded</dt>
          <dd className="text-foreground">{new Date(entry.recordedAt).toLocaleDateString()}</dd>
          <dt className="text-muted-foreground">SHA-256</dt>
          <dd className="truncate font-mono text-foreground" title={entry.fingerprint}>
            {entry.fingerprint}
          </dd>
        </dl>
      ) : null}
    </section>
  );
}

export function MediaCheckPanel({ url }: { url: string }) {
  const check = useMediaCheck();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<ShieldCheck size={14} />}
        disabled={check.isPending}
        onClick={() => check.mutate(url)}
      >
        {check.isPending ? "Checking" : "Check this file"}
      </Button>
      {check.data ? <MediaCheckResultCard result={check.data} /> : null}
      <Link to="/verify" className="text-xs text-muted-foreground underline">
        Check a file you were sent
      </Link>
    </div>
  );
}
