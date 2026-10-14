import z from "zod/v4";

export const queryBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true");
