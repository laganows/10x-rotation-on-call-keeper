import { describe, expect, it, vi } from "vitest";

import { createMember, listMembers, softDeleteMember } from "@/lib/services/members.service";

describe("members.service", () => {
  it("lists members with savedCount from assignments", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { team_id: "team-1", max_saved_count: 3 },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "members") {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    range: async () => ({
                      data: [
                        {
                          member_id: "member-1",
                          team_id: "team-1",
                          display_name: "Ada",
                          initial_on_call_count: 1,
                          created_at: "2024-01-01T00:00:00.000Z",
                          updated_at: "2024-01-01T00:00:00.000Z",
                          deleted_at: null,
                        },
                      ],
                      count: 1,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "plan_assignments") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  in: async () => ({
                    data: [{ member_id: "member-1" }, { member_id: "member-1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await listMembers(supabase as never, "user-1", { sort: "createdAt", order: "asc" });
    expect(result).toMatchInlineSnapshot(`
{
  "data": {
    "items": [
      {
        "createdAt": "2024-01-01T00:00:00.000Z",
        "deletedAt": null,
        "displayName": "Ada",
        "initialOnCallCount": 1,
        "memberId": "member-1",
        "savedCount": 2,
        "teamId": "team-1",
        "updatedAt": "2024-01-01T00:00:00.000Z",
      },
    ],
    "total": 1,
  },
  "error": null,
}
`);
  });

  it("uses maxSavedCount as initial_on_call_count when creating member", async () => {
    let capturedInsert: Record<string, unknown> | null = null;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { team_id: "team-1", max_saved_count: 3 },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "members") {
          return {
            insert: (payload: Record<string, unknown>) => {
              capturedInsert = payload;
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      member_id: "member-2",
                      team_id: "team-1",
                      display_name: "Grace",
                      initial_on_call_count: payload.initial_on_call_count,
                      created_at: "2024-02-01T00:00:00.000Z",
                      updated_at: "2024-02-01T00:00:00.000Z",
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await createMember(supabase as never, "user-1", "Grace");
    expect(capturedInsert?.initial_on_call_count).toBe(3);
    expect(result.data?.initialOnCallCount).toBe(3);
  });

  it("returns conflict when deleting already deleted member", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { team_id: "team-1", max_saved_count: 0 },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { deleted_at: "2024-01-01T00:00:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await softDeleteMember(supabase as never, "user-1", "member-1");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "code": "conflict",
    "message": "Member already deleted.",
  },
}
`);
  });
});
