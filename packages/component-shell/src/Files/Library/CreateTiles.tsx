import { Link } from "@ngriffin_uk/polychat-component-ui";
import { getFilesPath } from "@ngriffin_uk/polychat-library-react";
import {
  BookOpenText,
  Boxes,
  FolderPlus,
  ImagePlus,
  Loader2,
  type LucideIcon,
  Radio,
  Rss,
  StickyNote,
  Upload,
} from "lucide-react";

import type { CreateDialog, FileCreation } from "./useFileCreation.js";

const tileClassName =
  "group flex w-28 shrink-0 flex-col gap-2 text-left text-sm font-medium text-foreground no-underline hover:!no-underline focus-visible:outline-none sm:w-32";

function TileFace({ Icon, busy }: { Icon: LucideIcon; busy?: boolean }) {
  return (
    <span className="flex aspect-[16/11] items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-colors group-hover:border-border-strong group-hover:text-foreground group-focus-visible:border-ring">
      {busy ? (
        <Loader2 size={24} aria-hidden="true" className="animate-spin" />
      ) : (
        <Icon
          size={26}
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:-translate-y-0.5"
        />
      )}
    </span>
  );
}

function ActionTile({
  Icon,
  label,
  busy,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className={tileClassName} onClick={onClick} aria-busy={busy}>
        <TileFace Icon={Icon} busy={busy} />
        {label}
      </button>
    </li>
  );
}

function LinkTile({ Icon, label, href }: { Icon: LucideIcon; label: string; href: string }) {
  return (
    <li>
      <Link href={href} className={tileClassName}>
        <TileFace Icon={Icon} />
        {label}
      </Link>
    </li>
  );
}

const DIALOG_TILES: Array<{ dialog: CreateDialog; label: string; Icon: LucideIcon }> = [
  { dialog: "memory", label: "Memory", Icon: BookOpenText },
  { dialog: "folder", label: "Folder", Icon: FolderPlus },
  { dialog: "podcast", label: "Podcast", Icon: Radio },
  { dialog: "follow", label: "Follow", Icon: Rss },
];

export function CreateTiles({ basePath, creation }: { basePath: string; creation: FileCreation }) {
  return (
    <section aria-labelledby="files-create-heading" className="space-y-3">
      <h2 id="files-create-heading" className="text-sm text-muted-foreground">
        Make something new
      </h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <ActionTile
          Icon={Upload}
          label={creation.isUploading ? "Uploading…" : "Upload"}
          busy={creation.isUploading}
          onClick={creation.openUploadPicker}
        />
        <ActionTile
          Icon={StickyNote}
          label="Note"
          busy={creation.isCreatingNote}
          onClick={() => void creation.createNote()}
        />
        {DIALOG_TILES.map((tile) => (
          <ActionTile
            key={tile.dialog}
            Icon={tile.Icon}
            label={tile.label}
            onClick={() => creation.openDialog(tile.dialog)}
          />
        ))}
        <LinkTile Icon={ImagePlus} label="Image" href={getFilesPath(basePath, "studio")} />
        <LinkTile Icon={Boxes} label="Replicate" href={getFilesPath(basePath, "replicate")} />
      </ul>
    </section>
  );
}
