import z from "zod/v4";

export const BEDROCK_MANAGED_AGENT_REGIONS = ["us-east-1", "us-east-2", "us-west-2"] as const;
export const bedrockManagedAgentRegionSchema = z.enum(BEDROCK_MANAGED_AGENT_REGIONS);
export type BedrockManagedAgentRegion = z.infer<typeof bedrockManagedAgentRegionSchema>;

const RUNTIME_ARN_PATTERN =
  /^arn:aws:bedrock-agentcore:(us-east-1|us-east-2|us-west-2):([0-9]{12}):runtime\/[A-Za-z0-9_-]+$/u;
const ROLE_ARN_PATTERN = /^arn:aws:iam::([0-9]{12}):role\/[A-Za-z0-9_+=,.@/-]+$/u;

export const bedrockManagedAgentTargetSchema = z
  .object({
    runtimeArn: z
      .string()
      .trim()
      .regex(
        RUNTIME_ARN_PATTERN,
        "Use an AgentCore Runtime ARN in a supported Bedrock Managed Agents region",
      ),
    roleArn: z.string().trim().regex(ROLE_ARN_PATTERN, "Use an IAM role ARN"),
  })
  .strict()
  .refine(
    ({ runtimeArn, roleArn }) => {
      const runtimeAccount = RUNTIME_ARN_PATTERN.exec(runtimeArn)?.[2];
      const roleAccount = ROLE_ARN_PATTERN.exec(roleArn)?.[1];

      return !runtimeAccount || !roleAccount || runtimeAccount === roleAccount;
    },
    {
      message: "The session role and Runtime must belong to the same AWS account",
      path: ["roleArn"],
    },
  )
  .transform((target) => ({
    ...target,
    region: bedrockManagedAgentRegionSchema.parse(RUNTIME_ARN_PATTERN.exec(target.runtimeArn)?.[1]),
  }));
export type BedrockManagedAgentTarget = z.infer<typeof bedrockManagedAgentTargetSchema>;
