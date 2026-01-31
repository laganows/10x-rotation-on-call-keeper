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
