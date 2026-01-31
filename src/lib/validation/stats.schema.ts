import { z } from "zod";

import type { PlanId, StatsQuery, StatsScope } from "../../types";

const statsScopeSchema: z.ZodType<StatsScope> = z.enum(["global", "plan"]);

export const statsQuerySchema: z.ZodType<StatsQuery, z.ZodTypeDef, unknown> = z
  .object({
    scope: statsScopeSchema.optional(),
  })
  .strict()
  .transform((q) => ({
    scope: q.scope ?? "global",
  }));

export const planIdParamSchema: z.ZodType<PlanId> = z.string().uuid();

