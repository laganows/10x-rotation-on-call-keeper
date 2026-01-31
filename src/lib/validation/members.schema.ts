import { z } from "zod";

import type {
  CreateMemberCommand,
  MemberId,
  MembersListQuery,
  MembersListSort,
  MembersListStatus,
  PaginationOrder,
  UpdateMemberCommand,
} from "../../types";

const displayNameSchema = z.string().trim().min(1, "displayName is required.").max(100, "displayName is too long.");

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

export const memberIdParamSchema: z.ZodType<MemberId> = z.string().uuid();

export const createMemberSchema: z.ZodType<CreateMemberCommand> = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

export const updateMemberSchema: z.ZodType<UpdateMemberCommand> = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

const membersListStatusSchema: z.ZodType<MembersListStatus> = z.enum(["active", "all"]);
const membersListSortSchema: z.ZodType<MembersListSort> = z.enum(["createdAt", "displayName"]);
const paginationOrderSchema: z.ZodType<PaginationOrder> = z.enum(["asc", "desc"]);

/**
 * Query params for GET `/api/members`
 *
 * Notes:
 * - values come as strings, so we preprocess numbers
 * - `order` default depends on `sort` (createdAt -> desc, displayName -> asc)
 * - limit is clamped to max 200 (MVP protection)
 */
export const membersListQuerySchema: z.ZodType<MembersListQuery> = z
  .object({
    status: membersListStatusSchema.optional(),
    limit: numberFromString().optional(),
    offset: numberFromString().optional(),
    sort: membersListSortSchema.optional(),
    order: paginationOrderSchema.optional(),
  })
  .strict()
  .transform((q) => {
    const sort: MembersListSort = q.sort ?? "createdAt";
    const order: PaginationOrder = q.order ?? (sort === "createdAt" ? "desc" : "asc");

    const limitRaw = typeof q.limit === "number" && Number.isFinite(q.limit) ? q.limit : 50;
    const offsetRaw = typeof q.offset === "number" && Number.isFinite(q.offset) ? q.offset : 0;

    return {
      status: q.status ?? "active",
      sort,
      order,
      limit: clamp(Math.trunc(limitRaw), 1, 200),
      offset: Math.max(0, Math.trunc(offsetRaw)),
    };
  });
