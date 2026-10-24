import { chatStatements, guideStatements, SCENARIOS, seedGuideMarkdown } from "./chat.mjs";
import { continuityStatements } from "./continuity.mjs";
import {
  API_KEY,
  identityStatements,
  OWNER,
  SESSION_TOKEN,
  teammateStatements,
  usageStatements,
} from "./identity.mjs";
import { NOTEBOOK_FILES, notebookStatements } from "./notebooks/index.mjs";
import { SEED_SOURCE_FILES, sourceStatements } from "./sources.mjs";
import { workStatements } from "./work.mjs";

export async function buildSeed({ serverKey }) {
  const teammates = teammateStatements();
  const chat = chatStatements({ teammates });
  const work = await workStatements({ serverKey, teammates });
  const statements = [
    ...(await identityStatements({ serverKey })),
    ...teammates.statements,
    ...chat.statements,
    ...sourceStatements(),
    ...guideStatements(),
    ...work.statements,
    ...notebookStatements(),
    ...continuityStatements({ teammates, chat }),
    ...usageStatements(),
  ];

  return {
    statements,
    guide: seedGuideMarkdown(),
    files: [...Object.values(SEED_SOURCE_FILES), ...NOTEBOOK_FILES],
    scenarios: SCENARIOS,
    login: {
      email: OWNER.email,
      githubUsername: OWNER.githubUsername,
      sessionToken: SESSION_TOKEN,
      apiKey: API_KEY,
      encryptedKeysSeeded: Boolean(serverKey),
    },
  };
}
