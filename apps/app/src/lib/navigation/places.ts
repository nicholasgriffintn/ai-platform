export type ProductPlace = "chat" | "work" | "attention" | "files" | "library" | "you";

export type ProductMode = "chat" | "work";

export const PLACE_PATHS: Record<ProductPlace, string> = {
  chat: "/chat",
  work: "/work",
  attention: "/attention",
  files: "/files",
  library: "/teammates",
  you: "/profile",
};

const PLACE_PREFIXES: Array<[ProductPlace, string[]]> = [
  ["attention", ["/attention"]],
  ["files", ["/files"]],
  [
    "library",
    ["/teammates", "/chat/capabilities", "/chat/tools", "/chat/teammates", "/chat/experiences"],
  ],
  ["you", ["/profile"]],
  ["work", ["/work"]],
  ["chat", ["/", "/chat"]],
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") {
    return pathname === "/";
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getActivePlace(pathname: string): ProductPlace | undefined {
  for (const [place, prefixes] of PLACE_PREFIXES) {
    if (prefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
      return place;
    }
  }

  return undefined;
}

export function isProductModeRoute(pathname: string): boolean {
  const place = getActivePlace(pathname);

  return place !== undefined && place !== "you";
}

export function getProductMode(pathname: string): ProductMode {
  return getActivePlace(pathname) === "work" ? "work" : "chat";
}
