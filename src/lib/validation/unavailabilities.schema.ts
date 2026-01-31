import { z } from "zod";

import type {
  CreateUnavailabilityCommand,
  MemberId,
  PaginationOrder,
  UnavailabilitiesCreateQuery,
  UnavailabilitiesListQuery,
  UnavailabilitiesListSort,
  UnavailabilityId,
  UnavailabilityOnConflict,
} from "../../types";

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD.");
const uuidSchema = z.string().uuid();

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

export const unavailabilityIdParamSchema: z.ZodType<UnavailabilityId> = uuidSchema;
export const memberIdParamSchema: z.ZodType<MemberId> = uuidSchema;

export const createUnavailabilitySchema: z.ZodType<CreateUnavailabilityCommand> = z
  .object({
    memberId: uuidSchema,
    day: yyyyMmDdSchema,
  })
  .strict();

const unavailabilitiesListSortSchema: z.ZodType<UnavailabilitiesListSort> = z.enum(["day"]);
const paginationOrderSchema: z.ZodType<PaginationOrder> = z.enum(["asc", "desc"]);

export const unavailabilitiesListQuerySchema: z.ZodType<UnavailabilitiesListQuery, z.ZodTypeDef, unknown> = z
  .object({
    startDate: yyyyMmDdSchema,
    endDate: yyyyMmDdSchema,
    memberId: uuidSchema.optional(),
    limit: numberFromString().optional(),
    offset: numberFromString().optional(),
    sort: unavailabilitiesListSortSchema.optional(),
    order: paginationOrderSchema.optional(),
  })
  .strict()
  .transform((q) => {
    const sort: UnavailabilitiesListSort = q.sort ?? "day";
    const order: PaginationOrder = q.order ?? "asc";
    const limitRaw = typeof q.limit === "number" && Number.isFinite(q.limit) ? q.limit : 50;
    const offsetRaw = typeof q.offset === "number" && Number.isFinite(q.offset) ? q.offset : 0;

    return {
      startDate: q.startDate,
      endDate: q.endDate,
      memberId: q.memberId,
      sort,
      order,
      limit: clamp(Math.trunc(limitRaw), 1, 200),
      offset: Math.max(0, Math.trunc(offsetRaw)),
    };
  });

const unavailabilityOnConflictSchema: z.ZodType<UnavailabilityOnConflict> = z.enum(["error", "ignore"]);

export const unavailabilitiesCreateQuerySchema: z.ZodType<UnavailabilitiesCreateQuery, z.ZodTypeDef, unknown> = z
  .object({
    onConflict: unavailabilityOnConflictSchema.optional(),
  })
  .strict()
  .transform((q) => ({
    onConflict: q.onConflict ?? "error",
  }));

