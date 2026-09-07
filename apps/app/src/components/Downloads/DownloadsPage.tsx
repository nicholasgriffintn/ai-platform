import { buttonClassName, Card } from "@ngriffin_uk/polychat-component-ui";
import { useDesktopDownloads } from "@ngriffin_uk/polychat-library-react";
import type { DesktopDownload } from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Download, Loader2 } from "lucide-react";

const PLATFORM_NOTES: Record<DesktopDownload["platform"], string> = {
  macos: "Unzip it and drag Polychat to your Applications folder.",
  windows: "Unzip it and run the installer.",
  linux: "Unzip it and use the AppImage, or install the Debian package.",
};

const REQUIREMENTS = [
  "Polychat Desktop signs in to the same account as the web application, and your conversations follow you between them.",
  "Temporary chats stay on the device in local storage, and never reach the service.",
  "Device runtimes such as Ollama and LM Studio appear in the model list once the desktop application can see them.",
];

function DownloadCard({ download }: { download: DesktopDownload }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-base font-medium">{download.label}</h3>
        <p className="text-sm text-muted-foreground">{PLATFORM_NOTES[download.platform]}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{formatBytes(download.size)}</span>
        <a href={download.url} download className={buttonClassName()}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Download
        </a>
      </div>
    </Card>
  );
}

export function DownloadsPage() {
  const { data, isPending, isError } = useDesktopDownloads();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Polychat for your desktop</h1>
        <p className="text-muted-foreground">
          The same Polychat, running on your own machine, with models that never leave it.
        </p>
      </header>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Looking for the latest build
        </div>
      ) : null}

      {isError ? (
        <p className="text-sm text-muted-foreground">
          The download list is not answering at the moment. Try again shortly.
        </p>
      ) : null}

      {!isPending && !isError && !data ? (
        <p className="text-sm text-muted-foreground">
          Nothing has left the nest yet. The desktop application is still being packaged.
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-sm text-muted-foreground">
            Version {data.version}, released {formatDate(data.released_at)}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.downloads.map((download) => (
              <DownloadCard key={download.id} download={download} />
            ))}
          </div>
        </>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Before you install</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          {REQUIREMENTS.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
