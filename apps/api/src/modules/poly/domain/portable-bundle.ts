import {
  AIP_SIGNED_FIELDS,
  AIP_VERSION,
  NEVER_STANDING_TOOL_EFFECT_CLASSES,
  type AipPersistentMemory,
  type AipUnsignedBundle,
  type MemoryDocument,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";

export interface PortableProfile {
  readonly nickname?: string | null;
  readonly jobRole?: string | null;
  readonly traits?: string | null;
  readonly preferences?: string | null;
  readonly defaultModel?: string | null;
}

export interface PortableBundleInput {
  readonly polyContextId: string;
  readonly instance: string;
  readonly platformVersion: string;
  readonly now: Date;
  readonly profile: PortableProfile;
  readonly documents: readonly MemoryDocument[];
  readonly standingApprovals: readonly TeammateStandingApproval[];
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function userContext(profile: PortableProfile): AipPersistentMemory | null {
  const lines = [
    present(profile.nickname) ? `Name: ${present(profile.nickname)}` : null,
    present(profile.jobRole) ? `Role: ${present(profile.jobRole)}` : null,
    present(profile.preferences) ? `Preferences: ${present(profile.preferences)}` : null,
  ].filter((line): line is string => line !== null);

  return lines.length > 0
    ? { key: "user_context", value: lines.join("\n"), importance: 1, tags: ["identity", "context"] }
    : null;
}

export function buildPortableBundle(input: PortableBundleInput): AipUnsignedBundle {
  const exportedAt = input.now.toISOString();
  const nickname = present(input.profile.nickname);
  const personality = present(input.profile.traits);
  const defaultModel = present(input.profile.defaultModel);
  const context = userContext(input.profile);

  return {
    aip_version: AIP_VERSION,
    created_at: exportedAt,
    exported_by: {
      platform: "polychat",
      version: input.platformVersion,
      instance: input.instance,
    },
    identity: {
      id: `poly_${input.polyContextId}`,
      name: "Poly",
      description: nickname ? `Polychat assistant for ${nickname}` : "Polychat assistant",
      ...(personality ? { personality } : {}),
    },
    memory: {
      version: 1,
      exported_at: exportedAt,
      persistent: [
        ...(context ? [context] : []),
        ...input.documents.map((document) => ({
          key: document.name,
          value: document.content,
          created_at: document.createdAt,
          tags: ["memory-document"],
        })),
      ],
      entities: [],
      relations: [],
    },
    configuration: {
      model_preferences: defaultModel ? { default: defaultModel } : {},
    },
    learned_behaviors: {
      workflow_preferences: {
        prefers_confirmation_before: [...NEVER_STANDING_TOOL_EFFECT_CLASSES],
        auto_approves: input.standingApprovals
          .filter((approval) => Date.parse(approval.expiresAt) > input.now.getTime())
          .map((approval) => `${approval.toolName} on ${approval.destination}`),
      },
    },
    metadata: {
      export_includes: [...AIP_SIGNED_FIELDS],
      export_excludes: [
        "api_keys",
        "oauth_tokens",
        "payment_info",
        "conversations",
        "project_memory",
      ],
    },
  };
}
