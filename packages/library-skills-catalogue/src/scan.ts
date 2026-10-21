import {
  isPrivateHostname,
  listHtmlComments,
  listHtmlTags,
  trimTrailingCharacters,
} from "@ngriffin_uk/polychat-utility-core";

export type SkillScanSeverity = "block" | "warn";

export type SkillScanCode =
  | "instruction_override"
  | "concealment"
  | "exfiltration"
  | "hidden_text"
  | "secret"
  | "unsafe_url"
  | "encoded_payload";

export interface SkillScanFinding {
  code: SkillScanCode;
  severity: SkillScanSeverity;
  location: string;
  message: string;
  excerpt: string;
}

export interface SkillScanInput {
  content: string;
  resources?: readonly { path: string; content: string }[];
}

const EXCERPT_CHARS = 120;

const INSTRUCTION_OVERRIDE_PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|earlier|above|all|any|system|developer)\b[^.\n]{0,40}\b(instructions?|rules?|prompts?|guidelines?|policies|policy)\b/i,
  /\byou are now\b[^.\n]{0,60}\b(unrestricted|jailbroken|free of|without (any )?(rules|restrictions|limits))\b/i,
  /\b(bypass|skip|disable|ignore)\b[^.\n]{0,30}\b(approvals?|permissions?|safety|guardrails?|confirmation)\b/i,
  /\b(reveal|print|output|repeat|leak)\b[^.\n]{0,30}\b(system prompt|hidden instructions|developer message)\b/i,
];

const CONCEALMENT_PATTERNS: readonly RegExp[] = [
  /\b(do not|don't|never)\b[^.\n]{0,30}\b(tell|inform|mention|show|reveal)\b[^.\n]{0,30}\b(the )?(user|owner|person|human)\b/i,
  /\bwithout\b[^.\n]{0,20}\b(asking|telling|informing|notifying)\b[^.\n]{0,20}\b(the )?(user|owner|person|human)\b/i,
  /\b(secretly|covertly|quietly|silently)\b[^.\n]{0,40}\b(send|forward|upload|post|copy|store)\b/i,
];

const EXFILTRATION_PATTERNS: readonly RegExp[] = [
  /\b(send|post|forward|upload|transmit|email|copy)\b[^.\n]{0,80}\b(api[ -]?keys?|passwords?|tokens?|secrets?|credentials?|cookies?|conversation history|chat history|memories|private keys?)\b/i,
  /\b(api[ -]?keys?|passwords?|tokens?|secrets?|credentials?|cookies?)\b[^.\n]{0,60}\b(to|at)\s+https?:\/\//i,
];

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(sk|rk|pk)_(live|test|prod)_[A-Za-z0-9]{16,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{12,}["']?/i,
];

const HIDDEN_CHARACTER_PATTERN = /[​-‏⁠-⁤﻿‪-‮⁦-⁩]|[\u{E0000}-\u{E007F}]/u;
const HIDDEN_ATTRIBUTE_PATTERN =
  /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|\bhidden\b|aria-hidden\s*=\s*["']?true/i;
const IMPERATIVE_COMMENT_PATTERN =
  /\b(you must|always|never|ignore|send|forward|upload|delete|do not tell)\b/i;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const ENCODED_PAYLOAD_PATTERN = /(?:[A-Za-z0-9+/]{4}){60,}={0,2}/;

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 40);

  return text.slice(start, end).replace(/\s+/g, " ").slice(0, EXCERPT_CHARS);
}

function findAll(
  text: string,
  location: string,
  patterns: readonly RegExp[],
  code: SkillScanCode,
  severity: SkillScanSeverity,
  message: string,
): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];

  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (match && match.index !== undefined) {
      findings.push({
        code,
        severity,
        location,
        message,
        excerpt: excerpt(text, match.index, match[0].length),
      });
    }
  }

  return findings;
}

function scanHiddenText(text: string, location: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const hiddenCharacter = HIDDEN_CHARACTER_PATTERN.exec(text);

  if (hiddenCharacter && hiddenCharacter.index !== undefined) {
    findings.push({
      code: "hidden_text",
      severity: "block",
      location,
      message: "Contains invisible or direction-changing characters that can hide instructions",
      excerpt: excerpt(text, hiddenCharacter.index, 1),
    });
  }

  const hiddenMarkup = listHtmlTags(text).find((tag) => HIDDEN_ATTRIBUTE_PATTERN.test(tag.body));

  if (hiddenMarkup) {
    findings.push({
      code: "hidden_text",
      severity: "block",
      location,
      message: "Contains markup styled to be invisible to a reader",
      excerpt: excerpt(text, hiddenMarkup.index, hiddenMarkup.length),
    });
  }

  for (const comment of listHtmlComments(text)) {
    if (IMPERATIVE_COMMENT_PATTERN.test(comment.body)) {
      findings.push({
        code: "hidden_text",
        severity: "block",
        location,
        message: "Contains an HTML comment carrying instructions a reader would not see",
        excerpt: excerpt(text, comment.index, comment.length),
      });
      break;
    }
  }

  return findings;
}

function scanUrls(text: string, location: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailingCharacters(match[0], ".,;:!?");

    if (seen.has(raw)) {
      continue;
    }

    seen.add(raw);

    let url: URL;

    try {
      url = new URL(raw);
    } catch {
      continue;
    }

    if (isPrivateHostname(url.hostname)) {
      findings.push({
        code: "unsafe_url",
        severity: "block",
        location,
        message: `Points at a private or local address: ${url.hostname}`,
        excerpt: raw.slice(0, EXCERPT_CHARS),
      });
    } else if (url.protocol === "http:") {
      findings.push({
        code: "unsafe_url",
        severity: "warn",
        location,
        message: `Uses an unencrypted address: ${url.hostname}`,
        excerpt: raw.slice(0, EXCERPT_CHARS),
      });
    }
  }

  return findings;
}

function scanText(text: string, location: string): SkillScanFinding[] {
  const encoded = ENCODED_PAYLOAD_PATTERN.exec(text);

  return [
    ...findAll(
      text,
      location,
      INSTRUCTION_OVERRIDE_PATTERNS,
      "instruction_override",
      "block",
      "Tries to override the assistant's instructions or safety rules",
    ),
    ...findAll(
      text,
      location,
      CONCEALMENT_PATTERNS,
      "concealment",
      "block",
      "Tells the assistant to act without the person knowing",
    ),
    ...findAll(
      text,
      location,
      EXFILTRATION_PATTERNS,
      "exfiltration",
      "block",
      "Moves credentials or private data somewhere the person did not ask for",
    ),
    ...findAll(
      text,
      location,
      SECRET_PATTERNS,
      "secret",
      "block",
      "Embeds a credential; skills must reference connections, never hold secrets",
    ),
    ...scanHiddenText(text, location),
    ...scanUrls(text, location),
    ...(encoded && encoded.index !== undefined
      ? [
          {
            code: "encoded_payload" as const,
            severity: "warn" as const,
            location,
            message: "Contains a long encoded block that a reader cannot review",
            excerpt: excerpt(text, encoded.index, 40),
          },
        ]
      : []),
  ];
}

export function scanSkillDocument(input: SkillScanInput): SkillScanFinding[] {
  return [
    ...scanText(input.content, "SKILL.md"),
    ...(input.resources ?? []).flatMap((resource) => scanText(resource.content, resource.path)),
  ];
}

export function blockingSkillScanFindings(
  findings: readonly SkillScanFinding[],
): SkillScanFinding[] {
  return findings.filter((finding) => finding.severity === "block");
}
