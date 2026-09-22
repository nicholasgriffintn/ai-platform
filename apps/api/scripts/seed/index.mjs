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
import { workStatements } from "./work.mjs";

export async function buildSeed({ serverKey, credentials }) {
  const sessionToken = credentials?.sessionToken ?? SESSION_TOKEN;
  const apiKey = credentials ? (credentials.apiKey ?? null) : API_KEY;
  const teammates = teammateStatements();
  const chat = chatStatements({ teammates });
  const work = await workStatements({ serverKey, teammates });
  const statements = [
    ...(await identityStatements({
      serverKey,
      sessionToken,
      apiKey,
      sessionExpiresAt: credentials?.sessionExpiresAt,
    })),
    ...teammates.statements,
    ...chat.statements,
    ...guideStatements(),
    ...work.statements,
    ...continuityStatements({ teammates, chat, work }),
    ...usageStatements(),
  ];

  return {
    statements,
    guide: seedGuideMarkdown(),
    scenarios: SCENARIOS,
    login: {
      email: OWNER.email,
      githubUsername: OWNER.githubUsername,
      sessionToken,
      apiKey,
      encryptedKeysSeeded: Boolean(serverKey),
    },
  };
}
