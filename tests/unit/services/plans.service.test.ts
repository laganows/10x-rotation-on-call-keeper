import { describe, expect, it, vi } from "vitest";

import { savePlan } from "@/lib/services/plans.service";

describe("plans.service", () => {
  it("maps plan creation conflict to domain conflict error", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { team_id: "team-1" }, error: null }),
              }),
            }),
          };
        }

        if (table === "plans") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { code: "23P01", message: "conflict" },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await savePlan(supabase as never, "user-1", {
      startDate: "2024-01-01",
      endDate: "2024-01-02",
      durationMs: 0,
      assignments: [],
    });

    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "code": "conflict",
    "message": "Failed to create plan.",
  },
}
`);
  });
});
