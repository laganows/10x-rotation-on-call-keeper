import { describe, expect, it, vi } from "vitest";

import { getGlobalStats } from "@/lib/services/stats.service";

describe("stats.service", () => {
  it("builds days and members summary with edge cases", async () => {
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

        if (table === "members") {
          return {
            select: () => ({
              eq: () => ({
                is: async () => ({
                  data: [
                    { member_id: "member-1", display_name: "Ada" },
                    { member_id: "member-2", display_name: "Grace" },
                    { member_id: "member-3", display_name: "Linus" },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "plan_assignments") {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  { day: "2024-06-01", member_id: "member-1" },
                  { day: "2024-06-02", member_id: null },
                  { day: "2024-06-03", member_id: "member-2" },
                ],
                error: null,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await getGlobalStats(supabase as never, "user-1");
    expect(result).toMatchInlineSnapshot(`
{
  "data": {
    "byMember": [
      {
        "assignedDays": 1,
        "displayName": "Ada",
        "memberId": "member-1",
      },
      {
        "assignedDays": 1,
        "displayName": "Grace",
        "memberId": "member-2",
      },
      {
        "assignedDays": 0,
        "displayName": "Linus",
        "memberId": "member-3",
      },
    ],
    "days": {
      "total": 3,
      "unassigned": 1,
      "weekdays": 1,
      "weekends": 2,
    },
    "members": {
      "inequality": 1,
      "max": 1,
      "min": 0,
    },
    "scope": "global",
  },
  "error": null,
}
`);
  });
});
