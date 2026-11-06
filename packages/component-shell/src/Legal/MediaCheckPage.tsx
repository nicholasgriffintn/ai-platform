import { Prose } from "@ngriffin_uk/polychat-component-content";
import { APP_NAME } from "@ngriffin_uk/polychat-library-client";
import { useMediaCheck } from "@ngriffin_uk/polychat-library-react";
import { Upload } from "lucide-react";
import { type DragEvent, useState } from "react";

import { MediaCheckResultCard } from "../Files/Viewer/MediaCheckPanel.js";
import { PageShell } from "../Shell/PageShell.js";
import { StandardSidebarContent } from "../Sidebar/StandardSidebarContent.js";

export function MediaCheckPage() {
  const check = useMediaCheck();
  const [fileName, setFileName] = useState<string | null>(null);

  const checkFile = (file: File | null | undefined) => {
    if (file) {
      setFileName(file.name);
      check.mutate(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    checkFile(event.dataTransfer.files[0]);
  };

  return (
    <PageShell title="Check a file" sidebarContent={<StandardSidebarContent />}>
      <Prose>
        <p>
          See whether an image, video or audio file was generated with {APP_NAME}. Your file stays
          on your device: we only receive its SHA-256 fingerprint.
        </p>
      </Prose>
      <div className="mt-6 flex max-w-xl flex-col gap-4">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
        >
          <Upload size={20} aria-hidden="true" />
          <span>{check.isPending ? `Checking ${fileName}` : "Choose or drop a file"}</span>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            className="sr-only"
            onChange={(event) => checkFile(event.target.files?.[0])}
          />
        </label>
        {check.data ? <MediaCheckResultCard result={check.data} /> : null}
      </div>
    </PageShell>
  );
}
