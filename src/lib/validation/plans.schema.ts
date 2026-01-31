import { z } from "zod";

import type {
  PaginationOrder,
  PlanAssignmentsListQuery,
  PlanAssignmentsListSort,
  PlanId,
  PlanPreviewCommand,
  PlansListQuery,
  PlansListSort,
  SavePlanCommand,
  YyyyMmDd,
} from "../../types";

const isValidYyyyMmDd = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const yyyyMmDdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD.")
  .refine(isValidYyyyMmDd, "Invalid date value.");

const numberFromString = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return undefined;
      return Number(trimmed);
    }
    return value;
  }, z.number());

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const paginationOrderSchema: z.ZodType<PaginationOrder> = z.enum(["asc", "desc"]);
const plansListSortSchema: z.ZodType<PlansListSort> = z.enum(["createdAt", "startDate"]);
const planAssignmentsSortSchema: z.ZodType<PlanAssignmentsListSort> = z.enum(["day"]);

export const planIdParamSchema: z.ZodType<PlanId> = z.string().uuid();

export const plansListQuerySchema: z.ZodType<PlansListQuery, z.ZodTypeDef, unknown> = z
  .object({
    startDate: yyyyMmDdSchema.optional(),
    endDate: yyyyMmDdSchema.optional(),
    limit: numberFromString().optional(),
    offset: numberFromString().optional(),
    sort: plansListSortSchema.optional(),
    order: paginationOrderSchema.optional(),
  })
  .strict()
  .transform((q) => {
    const sort: PlansListSort = q.sort ?? "createdAt";
    const order: PaginationOrder = q.order ?? (sort === "createdAt" ? "desc" : "asc");
    const limitRaw = typeof q.limit === "number" && Number.isFinite(q.limit) ? q.limit : 50;
    const offsetRaw = typeof q.offset === "number" && Number.isFinite(q.offset) ? q.offset : 0;

    return {
      startDate: q.startDate,
      endDate: q.endDate,
      sort,
      order,
      limit: clamp(Math.trunc(limitRaw), 1, 200),
      offset: Math.max(0, Math.trunc(offsetRaw)),
    };
  });

export const planAssignmentsListQuerySchema: z.ZodType<PlanAssignmentsListQuery, z.ZodTypeDef, unknown> = z
  .object({
    limit: numberFromString().optional(),
    offset: numberFromString().optional(),
    sort: planAssignmentsSortSchema.optional(),
    order: paginationOrderSchema.optional(),
  })
  .strict()
  .transform((q) => {
    const sort: PlanAssignmentsListSort = q.sort ?? "day";
    const order: PaginationOrder = q.order ?? "asc";
    const limitRaw = typeof q.limit === "number" && Number.isFinite(q.limit) ? q.limit : 50;
    const offsetRaw = typeof q.offset === "number" && Number.isFinite(q.offset) ? q.offset : 0;

    return {
      sort,
      order,
      limit: clamp(Math.trunc(limitRaw), 1, 200),
      offset: Math.max(0, Math.trunc(offsetRaw)),
    };
  });

export const planPreviewCommandSchema: z.ZodType<PlanPreviewCommand> = z
  .object({
    startDate: yyyyMmDdSchema as z.ZodType<YyyyMmDd>,
    endDate: yyyyMmDdSchema as z.ZodType<YyyyMmDd>,
  })
  .strict();

export const savePlanCommandSchema: z.ZodType<SavePlanCommand> = z
  .object({
    startDate: yyyyMmDdSchema as z.ZodType<YyyyMmDd>,
    endDate: yyyyMmDdSchema as z.ZodType<YyyyMmDd>,
    assignments: z.array(
      z.object({
        day: yyyyMmDdSchema as z.ZodType<YyyyMmDd>,
        memberId: z.string().uuid().nullable(),
      })
    ),
    durationMs: z.number().int().min(0),
  })
  .strict();
