import type { DiscoverEdition } from "@ngriffin_uk/polychat-schemas";

import { buildHouseEdition } from "~/modules/discover/domain/house-edition";

export function readHouseEdition(now: Date = new Date()): DiscoverEdition {
  return buildHouseEdition({ date: now.toISOString().slice(0, 10), now });
}
