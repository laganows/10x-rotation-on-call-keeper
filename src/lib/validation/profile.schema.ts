import { z } from "zod";

import type { CreateProfileCommand, UpdateProfileCommand } from "../../types";

const displayNameSchema = z.string().nullable();

export const createProfileSchema: z.ZodType<CreateProfileCommand> = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

export const updateProfileSchema: z.ZodType<UpdateProfileCommand> = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();
