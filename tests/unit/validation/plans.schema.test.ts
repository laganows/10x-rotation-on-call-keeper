import { describe, expect, it } from "vitest";

import {
  planAssignmentsListQuerySchema,
  planPreviewCommandSchema,
  plansListQuerySchema,
  savePlanCommandSchema,
} from "@/lib/validation/plans.schema";

describe("plans.schema", () => {
  it("defaults plans list query and clamps pagination", () => {
    const result = plansListQuerySchema.parse({});
    expect(result).toMatchInlineSnapshot(`
{
  "endDate": undefined,
  "limit": 50,
  "offset": 0,
  "order": "desc",
  "sort": "createdAt",
  "startDate": undefined,
}
`);
  });

  it("validates date formats and values", () => {
    const ok = plansListQuerySchema.safeParse({ startDate: "2024-02-29", endDate: "2024-03-01" });
    expect(ok.success).toBe(true);

    const bad = plansListQuerySchema.safeParse({ startDate: "2024-02-30" });
    expect(bad.success).toBe(false);
  });

  it("defaults plan assignments list query", () => {
    const result = planAssignmentsListQuerySchema.parse({});
    expect(result).toMatchInlineSnapshot(`
{
  "limit": 50,
  "offset": 0,
  "order": "asc",
  "sort": "day",
}
`);
  });

  it("requires start/end dates for plan preview", () => {
    const ok = planPreviewCommandSchema.safeParse({ startDate: "2024-01-01", endDate: "2024-01-02" });
    expect(ok.success).toBe(true);

    const missing = planPreviewCommandSchema.safeParse({ startDate: "2024-01-01" });
    expect(missing.success).toBe(false);
  });

  it("validates save plan command assignments and duration", () => {
    const ok = savePlanCommandSchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2024-01-02",
      durationMs: 0,
      assignments: [
        { day: "2024-01-01", memberId: null },
        { day: "2024-01-02", memberId: "550e8400-e29b-41d4-a716-446655440000" },
      ],
    });
    expect(ok.success).toBe(true);

    const bad = savePlanCommandSchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2024-01-02",
      durationMs: -1,
      assignments: [],
    });
    expect(bad.success).toBe(false);
  });
});
