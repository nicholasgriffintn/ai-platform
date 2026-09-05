import z from "zod/v4";

import { sandboxCommandSchema } from "./sandbox-command";

export const sandboxServiceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens");

export const sandboxServiceWorkingDirectorySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?:\.|[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)$/, "Use a repository-relative directory")
  .refine(
    (value) =>
      value === "." || value.split("/").every((segment) => segment !== "." && segment !== ".."),
    { error: "Working directory cannot leave the repository" },
  );

export const sandboxServicePortSchema = z
  .number()
  .int()
  .min(1024)
  .max(65535)
  .refine((port) => port !== 3000, { error: "Port 3000 is reserved by the sandbox" });

export const sandboxServiceHealthCheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tcp") }).strict(),
  z
    .object({
      type: z.literal("http"),
      path: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/, "Use an HTTP path without a host or query"),
      expectedStatus: z
        .object({
          min: z.number().int().min(100).max(599),
          max: z.number().int().min(100).max(599),
        })
        .strict()
        .refine((value) => value.min <= value.max, {
          error: "Minimum status cannot exceed maximum status",
        })
        .default({ min: 200, max: 399 }),
    })
    .strict(),
]);

export const sandboxServiceRestartPolicySchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("never"),
      maxRestarts: z.literal(0).default(0),
      backoffSeconds: z.number().int().min(1).max(30).default(1),
    })
    .strict(),
  z
    .object({
      mode: z.literal("on_failure"),
      maxRestarts: z.number().int().min(1).max(3).default(1),
      backoffSeconds: z.number().int().min(1).max(30).default(2),
    })
    .strict(),
  z
    .object({
      mode: z.literal("always"),
      maxRestarts: z.number().int().min(1).max(3).default(1),
      backoffSeconds: z.number().int().min(1).max(30).default(2),
    })
    .strict(),
]);

export const sandboxServiceDefinitionSchema = z
  .object({
    name: sandboxServiceNameSchema,
    workingDirectory: sandboxServiceWorkingDirectorySchema.default("."),
    command: sandboxCommandSchema,
    dependencies: z.array(sandboxServiceNameSchema).max(8).default([]),
    expectedPort: sandboxServicePortSchema.optional(),
    healthCheck: sandboxServiceHealthCheckSchema.optional(),
    startupTimeoutSeconds: z.number().int().min(5).max(300).default(60),
    restartPolicy: sandboxServiceRestartPolicySchema.default({
      mode: "never",
      maxRestarts: 0,
      backoffSeconds: 1,
    }),
  })
  .strict()
  .superRefine((service, context) => {
    if ((service.expectedPort === undefined) !== (service.healthCheck === undefined)) {
      context.addIssue({
        code: "custom",
        path: service.expectedPort === undefined ? ["expectedPort"] : ["healthCheck"],
        message: "Expected port and health check must be configured together",
      });
    }

    if (new Set(service.dependencies).size !== service.dependencies.length) {
      context.addIssue({
        code: "custom",
        path: ["dependencies"],
        message: "Service dependencies must be unique",
      });
    }
  });

export const sandboxServiceManifestSchema = z
  .array(sandboxServiceDefinitionSchema)
  .max(8)
  .superRefine((services, context) => {
    const serviceIndexes = new Map<string, number>();
    const ports = new Map<number, number>();

    for (const [index, service] of services.entries()) {
      const existingServiceIndex = serviceIndexes.get(service.name);

      if (existingServiceIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: `Service name is already used by service ${existingServiceIndex + 1}`,
        });
      } else {
        serviceIndexes.set(service.name, index);
      }

      if (service.expectedPort !== undefined) {
        const existingPortIndex = ports.get(service.expectedPort);

        if (existingPortIndex !== undefined) {
          context.addIssue({
            code: "custom",
            path: [index, "expectedPort"],
            message: `Port is already declared by service ${existingPortIndex + 1}`,
          });
        } else {
          ports.set(service.expectedPort, index);
        }
      }
    }

    for (const [index, service] of services.entries()) {
      for (const dependency of service.dependencies) {
        if (dependency === service.name) {
          context.addIssue({
            code: "custom",
            path: [index, "dependencies"],
            message: "A service cannot depend on itself",
          });
        } else if (!serviceIndexes.has(dependency)) {
          context.addIssue({
            code: "custom",
            path: [index, "dependencies"],
            message: `Unknown service dependency: ${dependency}`,
          });
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    let cycleReported = false;
    const visit = (name: string): void => {
      if (cycleReported || visited.has(name)) {
        return;
      }

      if (visiting.has(name)) {
        cycleReported = true;
        const index = serviceIndexes.get(name) ?? 0;

        context.addIssue({
          code: "custom",
          path: [index, "dependencies"],
          message: "Service dependencies must not contain a cycle",
        });

        return;
      }

      visiting.add(name);
      const service = services[serviceIndexes.get(name) ?? -1];

      for (const dependency of service?.dependencies ?? []) {
        if (serviceIndexes.has(dependency)) {
          visit(dependency);
        }
      }

      visiting.delete(name);
      visited.add(name);
    };

    for (const service of services) {
      visit(service.name);
    }
  });

export const sandboxServiceActionSchema = z.enum(["start", "restart", "stop"]);
export const sandboxServiceStatusSchema = z.enum([
  "starting",
  "running",
  "healthy",
  "unhealthy",
  "restarting",
  "stopped",
  "failed",
  "timed_out",
]);

export const sandboxRunServiceEvidenceSchema = z
  .object({
    name: sandboxServiceNameSchema,
    workingDirectory: sandboxServiceWorkingDirectorySchema,
    status: sandboxServiceStatusSchema,
    expectedPort: sandboxServicePortSchema.optional(),
    healthCheck: sandboxServiceHealthCheckSchema.optional(),
    restartCount: z.number().int().nonnegative(),
    startedAt: z.string().trim().min(1).optional(),
    healthyAt: z.string().trim().min(1).optional(),
    stoppedAt: z.string().trim().min(1).optional(),
    error: z.string().trim().min(1).optional(),
  })
  .strict();

export type SandboxServiceDefinition = z.infer<typeof sandboxServiceDefinitionSchema>;
export type SandboxServiceManifest = z.infer<typeof sandboxServiceManifestSchema>;
export type SandboxServiceHealthCheck = z.infer<typeof sandboxServiceHealthCheckSchema>;
export type SandboxServiceAction = z.infer<typeof sandboxServiceActionSchema>;
export type SandboxServiceStatus = z.infer<typeof sandboxServiceStatusSchema>;
export type SandboxRunServiceEvidence = z.infer<typeof sandboxRunServiceEvidenceSchema>;
