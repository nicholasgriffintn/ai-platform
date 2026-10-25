import { DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { useRecipeConnectors } from "@ngriffin_uk/polychat-library-react";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";
import { Send } from "lucide-react";

import type { OpenStudioItem } from "./studio-entries.js";

const SEND_TARGETS: ReadonlyArray<{
  provider: RecipeConnectorProvider;
  label: string;
  describe: (title: string) => string;
}> = [
  {
    provider: "googledocs",
    label: "Google Docs",
    describe: (title) =>
      `Send "${title}" from this notebook to Google Docs: create a new document with its full content through the Google Docs connector, then give me the link.`,
  },
  {
    provider: "googleslides",
    label: "Google Slides",
    describe: (title) =>
      `Send "${title}" from this notebook to Google Slides: create a presentation from it through the Google Slides connector, one slide per section, then give me the link.`,
  },
  {
    provider: "googlesheets",
    label: "Google Sheets",
    describe: (title) =>
      `Send "${title}" from this notebook to Google Sheets: create a spreadsheet with its rows through the Google Sheets connector, then give me the link.`,
  },
  {
    provider: "devto",
    label: "DEV as a draft",
    describe: (title) =>
      `Publish "${title}" from this notebook to DEV as an unpublished draft article through the DEV connector, then give me the link.`,
  },
];

export function StudioSendToMenu({
  item,
  onAsk,
}: {
  item: OpenStudioItem;
  onAsk: (prompt: string) => void;
}) {
  const { data } = useRecipeConnectors({ status: "connected" });
  const connected = new Set(
    (data?.connectors ?? [])
      .filter((connector) => connector.status === "connected")
      .map((connector) => connector.id),
  );
  const targets = SEND_TARGETS.filter((target) => connected.has(target.provider));

  if (item.origin !== "output" || targets.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={<Send className="size-4" aria-hidden />}
      buttonProps={{ variant: "icon", "aria-label": "Send to a connected service" }}
    >
      {targets.map((target) => (
        <DropdownMenuItem key={target.provider} onClick={() => onAsk(target.describe(item.title))}>
          {target.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}
