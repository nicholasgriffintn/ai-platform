import { CopyButton } from "@ngriffin_uk/polychat-component-shell";
import { Card } from "@ngriffin_uk/polychat-component-ui";
import { CLI_LOGIN_COMMAND, CLI_PACKAGE_NAME } from "@ngriffin_uk/polychat-library-client";
import { SquareTerminal } from "lucide-react";

const INSTALL_COMMAND = `npm install -g ${CLI_PACKAGE_NAME}`;

const SAMPLE_CODE = "BCDF-GHJK";

const COMMANDS: Array<{ command: string; description: string }> = [
  { command: "status", description: "Which account the saved key belongs to" },
  { command: "token", description: "Print the key for a gateway or script" },
  { command: "logout", description: "Forget the key on this machine" },
];

function CommandRow({ label, command }: { label: string; command: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="polychat-eyebrow">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto font-mono text-sm whitespace-nowrap">
          {command}
        </code>
        <CopyButton value={command} />
      </div>
    </div>
  );
}

function TerminalPreview() {
  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-canvas"
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-1.5 border-b border-border px-3 py-2"
        aria-hidden="true"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
      </div>
      <pre
        className="flex-1 [scrollbar-width:none] overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground"
        aria-hidden="true"
      >
        <span className="text-foreground">$ polychat login</span>
        {"\n\n  Your code   "}
        <span className="font-semibold text-active-work">{SAMPLE_CODE}</span>
        {"\n  Approve at  polychat.app/device\n\n"}
        {"Opened the approval page in your browser.\n"}
        {"Waiting for approval. The code expires in 10 minutes.\n\n"}
        <span className="text-success">Signed in.</span>
        {"\nKey saved. Print it with: polychat token"}
      </pre>
    </div>
  );
}

export function CliSection() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="downloads-cli">
      <div className="flex flex-col gap-1">
        <h2 id="downloads-cli" className="text-lg font-semibold">
          Or pair from a terminal
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          For servers, scripts and self-hosted gateways such as OpenClaw or Hermes. No pasted keys:
          the CLI shows a code, you approve it in the browser, and the machine gets a key of its
          own.
        </p>
      </div>

      <Card className="grid gap-6 p-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground">
              <SquareTerminal className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold">Polychat CLI</h3>
              <p className="text-sm text-muted-foreground">Node.js 20 or later, on any platform.</p>
            </div>
          </div>
          <CommandRow label="Run once" command={CLI_LOGIN_COMMAND} />
          <CommandRow label="Or install it" command={INSTALL_COMMAND} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {COMMANDS.map(({ command, description }) => (
              <div key={command} className="contents">
                <dt className="font-mono text-foreground">polychat {command}</dt>
                <dd className="text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
        <TerminalPreview />
      </Card>
    </section>
  );
}
