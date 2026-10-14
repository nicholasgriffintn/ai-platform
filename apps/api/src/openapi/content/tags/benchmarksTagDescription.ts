import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const benchmarksTagDescription = md`
# Benchmarks

Boards that pit models against each other, each with official standings, a people's baseline and a medal table.

- Run a benchmark against up to five models you can use, including models on your own keys, or against a workspace's active routes. \`POST /benchmarks/runs/estimate\` checks eligibility and cost first.
- Vote on blind arena pairs, or play a board yourself and score the game.
- Share a run by link. Owners can withdraw and restore their runs.
`;
