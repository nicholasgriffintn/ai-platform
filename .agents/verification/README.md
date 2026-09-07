# Verification queue

`pending/` holds one item per unverified change: what changed, what an operator must do first, and the steps to confirm it works against the deployed product. `archive/` holds the items already checked, grouped by the deploy they were checked against.

Agents write items here as they work. A validation agent will later review and check off items it is able to verify. If it cannot, it will flag it for the human operator to review.

The process, item format, and the way to rebuild this queue from the last deployment live in [verification.md](../skills/polychat-setup/references/verification.md).
