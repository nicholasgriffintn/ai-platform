import { slugify } from "@ngriffin_uk/polychat-utility-core";

export function outletId(name: string): string {
  return slugify(name, 60) || "unknown";
}
