import { chatStatements, guideStatements, SCENARIOS, seedGuideMarkdown } from "./chat.mjs";
import {
  API_KEY,
  identityStatements,
  OWNER,
  SESSION_TOKEN,
  teammateStatements,
  usageStatements,
} from "./identity.mjs";
import { workStatements } from "./work.mjs";

export async function buildSeed({ serverKey }) {
  const teammates = teammateStatements();
  const chat = chatStatements({ teammates });
  const work = await workStatements({ serverKey, teammates });
  const statements = [
    ...(await identityStatements({ serverKey })),
    ...teammates.statements,
    ...chat.statements,
    ...guideStatements(),
    ...work.statements,
    ...usageStatements(),
  ];

  return {
    statements,
    guide: seedGuideMarkdown(),
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
