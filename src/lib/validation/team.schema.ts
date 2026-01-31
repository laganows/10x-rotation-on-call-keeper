import { z } from "zod";

import type { CreateTeamCommand, UpdateTeamCommand } from "../../types";

const nameSchema = z.string().trim().min(1, "name is required.").max(100, "name is too long.");

export const createTeamSchema: z.ZodType<CreateTeamCommand> = z
  .object({
    name: nameSchema,
  })
  .strict();

export const updateTeamSchema: z.ZodType<UpdateTeamCommand> = z
  .object({
    name: nameSchema,
  })
  .strict();
