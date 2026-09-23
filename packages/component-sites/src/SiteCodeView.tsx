import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteFile } from "@ngriffin_uk/polychat-schemas";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export interface SiteCodeViewProps {
  files: SiteFile[];
  className?: string;
}

function groupFiles(files: SiteFile[]): Array<{ folder: string; files: SiteFile[] }> {
  const groups = new Map<string, SiteFile[]>();

  for (const file of files) {
    const folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    const bucket = groups.get(folder) ?? [];

    bucket.push(file);
    groups.set(folder, bucket);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, entries]) => ({ folder, files: entries }));
}

export function SiteCodeView({ files, className }: SiteCodeViewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    () => files.find((file) => file.path === "app/page.tsx")?.path ?? files[0]?.path ?? null,
  );
  const [copied, setCopied] = useState(false);
  const selected = files.find((file) => file.path === selectedPath) ?? files[0] ?? null;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = setTimeout(() => setCopied(false), 1500);

    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (!selected) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selected.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn("grid h-full min-h-0 grid-cols-[14rem_minmax(0,1fr)] bg-background", className)}
    >
      <nav className="min-h-0 overflow-auto border-r py-2 text-xs">
        {groupFiles(files).map((group) => (
          <div key={group.folder || "root"} className="mb-2">
            {group.folder && (
              <div className="px-3 py-1 font-medium text-muted-foreground">{group.folder}</div>
            )}
            {group.files.map((file) => {
              const name = file.path.slice(file.path.lastIndexOf("/") + 1);

              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={cn(
                    "block w-full truncate px-3 py-1 text-left font-mono transition-colors hover:bg-accent",
                    group.folder && "pl-6",
                    selected?.path === file.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex min-h-0 flex-col">
        <div className="flex h-9 items-center justify-between border-b px-3 font-mono text-xs text-muted-foreground">
          <span className="truncate">{selected?.path}</span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground"
            aria-label="Copy file"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          <code>{selected?.content}</code>
        </pre>
      </div>
    </div>
  );
}
