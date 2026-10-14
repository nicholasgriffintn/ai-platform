import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const machinesTagDescription = md`
# Machines

The protocol a signed-in desktop uses to offer itself as an environment. It heartbeats its runtime metadata, claims the next queued run and reports progress. Start runs on a machine through \`/environments\`.
`;
