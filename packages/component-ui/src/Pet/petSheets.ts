import {
  findPetSheetLayout,
  PET_PRESETS,
  type PetSheetLayout,
} from "@ngriffin_uk/polychat-schemas";

import ash from "../pets/ash.png";
import bit from "../pets/bit.png";
import flask from "../pets/flask.png";
import kea from "../pets/kea.png";
import moss from "../pets/moss.png";
import pip from "../pets/pip.png";
import prism from "../pets/prism.png";
import sprocket from "../pets/sprocket.png";
import wisp from "../pets/wisp.png";

const BUILT_IN_PET_SHEETS = new Map<string, string>([
  ["/pets/ash.png", ash],
  ["/pets/bit.png", bit],
  ["/pets/flask.png", flask],
  ["/pets/kea.png", kea],
  ["/pets/moss.png", moss],
  ["/pets/pip.png", pip],
  ["/pets/prism.png", prism],
  ["/pets/sprocket.png", sprocket],
  ["/pets/wisp.png", wisp],
]);

const BUILT_IN_PET_LAYOUTS = new Map(
  PET_PRESETS.map((preset) => [preset.sheetUrl, preset.layoutId]),
);

export function resolvePetSheetUrl(sheetUrl: string): string {
  return BUILT_IN_PET_SHEETS.get(sheetUrl) ?? sheetUrl;
}

export function resolvePetSheetLayout(sheetUrl: string): PetSheetLayout {
  return findPetSheetLayout(BUILT_IN_PET_LAYOUTS.get(sheetUrl));
}
