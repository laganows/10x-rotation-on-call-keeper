import { describe, expect, it, vi } from "vitest";

import {
  createUnavailability,
  deleteUnavailability,
} from "@/lib/services/unavailabilities.service";

describe("unavailabilities.service", () => {
  it("returns existing item when onConflict is ignore and record already exists", async () => {
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
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({ data: { member_id: "member-1" }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "unavailabilities") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { code: "23505", message: "duplicate" },
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        unavailability_id: "u-1",
                        team_id: "team-1",
                        member_id: "member-1",
                        day: "2024-01-10",
                        created_at: "2024-01-01T00:00:00.000Z",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await createUnavailability(
      supabase as never,
      "user-1",
      "member-1",
      "2024-01-10",
      "ignore"
    );

    expect(result).toMatchInlineSnapshot(`
{
  "data": {
    "item": {
      "createdAt": "2024-01-01T00:00:00.000Z",
      "day": "2024-01-10",
      "memberId": "member-1",
      "teamId": "team-1",
      "unavailabilityId": "u-1",
    },
    "wasExisting": true,
  },
  "error": null,
}
`);
  });

  it("returns not_found when member is inactive", async () => {
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
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await createUnavailability(
      supabase as never,
      "user-1",
      "member-1",
      "2024-01-10",
      "error"
    );

    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "code": "not_found",
    "message": "Member not found.",
  },
}
`);
  });

  it("returns not_found when delete affects no rows", async () => {
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

        if (table === "unavailabilities") {
          return {
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  select: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await deleteUnavailability(supabase as never, "user-1", "u-1");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "code": "not_found",
    "message": "Unavailability not found.",
  },
}
`);
  });
});
