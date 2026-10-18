import { UNDECLARED_TOOL_EFFECT_CLASS, type ToolEffectClass } from "@ngriffin_uk/polychat-schemas";

const VERB_CLASSES: ReadonlyArray<readonly [ToolEffectClass, ReadonlySet<string>]> = [
  [
    "read",
    new Set([
      "get",
      "list",
      "search",
      "fetch",
      "find",
      "read",
      "lookup",
      "query",
      "retrieve",
      "describe",
      "count",
      "check",
      "view",
      "browse",
      "show",
      "preview",
      "filter",
    ]),
  ],
  [
    "destructive",
    new Set([
      "delete",
      "remove",
      "destroy",
      "purge",
      "wipe",
      "drop",
      "truncate",
      "uninstall",
      "revoke",
      "erase",
      "discard",
    ]),
  ],
  [
    "external_send",
    new Set([
      "send",
      "reply",
      "email",
      "mail",
      "publish",
      "notify",
      "invite",
      "forward",
      "broadcast",
      "tweet",
      "dm",
      "sms",
      "post",
      "share",
      "announce",
      "message",
      "call",
      "dial",
    ]),
  ],
  ["spend", new Set(["pay", "charge", "purchase", "buy", "refund", "payout", "checkout", "bill"])],
  ["data_export", new Set(["export", "download", "dump", "backup"])],
];

const CREDENTIAL_NOUNS = new Set([
  "password",
  "secret",
  "credential",
  "token",
  "apikey",
  "key",
  "oauth",
  "login",
  "passkey",
]);

const SPEND_NOUNS = new Set(["payment", "charge", "refund", "payout", "checkout"]);

function tokenise(operation: string): string[] {
  return operation
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function singular(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function classFromVerb(tokens: readonly string[]): ToolEffectClass | undefined {
  for (const token of tokens) {
    for (const [effectClass, verbs] of VERB_CLASSES) {
      if (verbs.has(token)) {
        return effectClass;
      }
    }
  }

  return undefined;
}

export function classifyOperationEffect(
  operation: string,
  fallback: ToolEffectClass = UNDECLARED_TOOL_EFFECT_CLASS,
): ToolEffectClass {
  const tokens = tokenise(operation);
  const nouns = new Set(tokens.map(singular));
  const base = classFromVerb(tokens) ?? fallback;

  if ([...nouns].some((noun) => CREDENTIAL_NOUNS.has(noun))) {
    return "credential";
  }

  if (base !== "read" && [...nouns].some((noun) => SPEND_NOUNS.has(noun))) {
    return "spend";
  }

  return base;
}
