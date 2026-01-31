import { describe, expect, it } from "vitest";

import { createTeamForOwner, getTeamByOwnerId } from "@/lib/services/team.service";

describe("team.service", () => {
  it("maps team when found by owner id", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                team_id: "team-1",
                owner_id: "user-1",
                name: "On-call",
                max_saved_count: 2,
                created_at: "2024-01-01T00:00:00.000Z",
                updated_at: "2024-01-02T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await getTeamByOwnerId(supabase as never, "user-1");
    expect(result).toMatchInlineSnapshot(`
{
  "data": {
    "createdAt": "2024-01-01T00:00:00.000Z",
    "maxSavedCount": 2,
    "name": "On-call",
    "ownerId": "user-1",
    "teamId": "team-1",
    "updatedAt": "2024-01-02T00:00:00.000Z",
  },
  "error": null,
}
`);
  });

  it("returns fallback error when team creation returns no data", async () => {
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await createTeamForOwner(supabase as never, "user-1", "Team");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "message": "Team creation returned no data.",
  },
}
`);
  });
});
