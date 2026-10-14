import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const usageTagDescription = md`
# Usage

Credit accounting for the period. Read the balance (included, used, reserved and overage credits), summarise spend by source and vendor, or page through ledger events.

\`POST /usage/events\` records a zero-cost event for a model that ran outside the hosted service.
`;
