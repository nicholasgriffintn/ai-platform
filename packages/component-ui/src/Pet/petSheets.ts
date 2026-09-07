import ash from "../pets/ash.png";
import bit from "../pets/bit.png";
import flask from "../pets/flask.png";
import kea from "../pets/kea.png";
import moss from "../pets/moss.png";
import pip from "../pets/pip.png";
import prism from "../pets/prism.png";
import sprocket from "../pets/sprocket.png";

const BUILT_IN_PET_SHEETS = new Map<string, string>([
  ["/pets/ash.png", ash],
  ["/pets/bit.png", bit],
  ["/pets/flask.png", flask],
  ["/pets/kea.png", kea],
  ["/pets/moss.png", moss],
  ["/pets/pip.png", pip],
  ["/pets/prism.png", prism],
  ["/pets/sprocket.png", sprocket],
]);

export function resolvePetSheetUrl(sheetUrl: string): string {
  return BUILT_IN_PET_SHEETS.get(sheetUrl) ?? sheetUrl;
}
