import { buttonClassName, Card } from "@ngriffin_uk/polychat-component-ui";
import { useDesktopDownloads } from "@ngriffin_uk/polychat-library-react";
import type { DesktopDownload, DesktopPlatform } from "@ngriffin_uk/polychat-schemas";
import { DESKTOP_PLATFORMS } from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatDate } from "@ngriffin_uk/polychat-utility-core";
import {
  Apple,
  Bot,
  Cpu,
  Download,
  Ghost,
  Laptop,
  Loader2,
  type LucideIcon,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";

const PLATFORM_DETAILS: Record<
  DesktopPlatform,
  { label: string; icon: LucideIcon; requirement: string; install: string }
> = {
  macos: {
    label: "macOS",
    icon: Apple,
    requirement: "macOS 13 or later, Apple silicon or Intel.",
    install: "Unzip it and drag Polychat to your Applications folder.",
  },
  windows: {
    label: "Windows",
    icon: Monitor,
    requirement: "Windows 10 or later, 64-bit.",
    install: "Unzip it and run the installer.",
  },
  linux: {
    label: "Linux",
    icon: Terminal,
    requirement: "A recent 64-bit distribution with WebKitGTK.",
    install: "Use the AppImage, or install the Debian package.",
  },
};

const REASONS: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Cpu,
    title: "Models that never leave the machine",
    description:
      "Ollama and LM Studio appear in the picker beside the hosted catalogue. Pick one and the answer is produced on this Mac, not on ours.",
  },
  {
    icon: Bot,
    title: "Coding agents in your own folders",
    description:
      "Claude Code, Codex and the rest run as ordinary providers against a directory you choose, on your subscription, with a permission mode you set per chat.",
  },
  {
    icon: Ghost,
    title: "Temporary chats that stay put",
    description:
      "A temporary chat lives in local storage and never reaches the service. Keep it later with one click if it turns out to matter.",
  },
  {
    icon: Smartphone,
    title: "Hand a turn to this machine from anywhere",
    description:
      "Start on your phone or in a browser, choose this machine in the picker, and the desktop picks the turn up and carries on.",
  },
];

const BOUNDARIES = [
  "It signs in to the same account as the web application, and kept conversations follow you between them.",
  "Nothing is probed until you connect a runtime. The desktop never scans your machine on its own.",
  "A local agent runs with your privileges in the folder you grant it, and Polychat never touches its sign-in or its tokens.",
  "Updates are signed and checked before they are applied.",
];

function PlatformCard({
  platform,
  download,
}: {
  platform: DesktopPlatform;
  download?: DesktopDownload;
}) {
  const details = PLATFORM_DETAILS[platform];
  const Icon = details.icon;

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{download?.label ?? details.label}</h3>
          <p className="text-sm text-muted-foreground">{details.requirement}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{details.install}</p>
      <div className="mt-auto flex items-center justify-between gap-3">
        {download ? (
          <>
            <span className="text-xs text-muted-foreground">
              {download.architecture} · {formatBytes(download.size)}
            </span>
            <a href={download.url} download className={buttonClassName()}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download
            </a>
          </>
        ) : (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not packaged yet
          </span>
        )}
      </div>
    </Card>
  );
}

export function DownloadsPage() {
  const { data, isPending, isError, refetch } = useDesktopDownloads();
  const downloadsByPlatform = new Map<DesktopPlatform, DesktopDownload[]>();

  for (const download of data?.downloads ?? []) {
    downloadsByPlatform.set(download.platform, [
      ...(downloadsByPlatform.get(download.platform) ?? []),
      download,
    ]);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
      <header className="flex flex-col gap-3">
        <p className="polychat-eyebrow">Polychat Desktop</p>
        <h1 className="font-display text-3xl font-medium tracking-tight text-balance md:text-4xl">
          The same Polychat, running on your own machine.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Everything from the web application, plus the models, agents and folders that live on this
          computer. Answers can stay here, chats can stay here, and the picker shows all of it in
          one place.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Looking for the latest build
            </span>
          ) : null}
          {data ? (
            <span>
              Version {data.version}, released {formatDate(data.released_at)}.
            </span>
          ) : null}
          {!isPending && !isError && !data ? (
            <span>Nothing has left the nest yet. The first build is being packaged.</span>
          ) : null}
          {isError ? (
            <span className="inline-flex items-center gap-2">
              The download list is not answering right now.
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            </span>
          ) : null}
        </div>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="downloads-platforms">
        <h2 id="downloads-platforms" className="text-lg font-semibold">
          Choose your platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DESKTOP_PLATFORMS.map((platform) => {
            const downloads = downloadsByPlatform.get(platform) ?? [];

            return downloads.length > 0 ? (
              downloads.map((download) => (
                <PlatformCard key={download.id} platform={platform} download={download} />
              ))
            ) : (
              <PlatformCard key={platform} platform={platform} />
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="downloads-reasons">
        <h2 id="downloads-reasons" className="text-lg font-semibold">
          What the desktop adds
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {REASONS.map((reason) => {
            const Icon = reason.icon;

            return (
              <div key={reason.title} className="flex gap-3 rounded-xl border border-border p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active-work/12 text-active-work">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{reason.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {reason.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border border-border bg-surface p-6 md:grid-cols-[auto_1fr]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What it will and won’t do</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {BOUNDARIES.map((boundary) => (
              <li key={boundary} className="flex gap-2">
                <Laptop className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{boundary}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
