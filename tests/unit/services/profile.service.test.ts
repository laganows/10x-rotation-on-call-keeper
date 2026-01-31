import { describe, expect, it } from "vitest";

import { createProfile, getProfileByUserId, updateProfile } from "@/lib/services/profile.service";

describe("profile.service", () => {
  it("returns null when profile does not exist", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await getProfileByUserId(supabase as never, "user-1");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": null,
}
`);
  });

  it("returns fallback error when creation returns no data", async () => {
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await createProfile(supabase as never, "user-1", "Ada");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": {
    "message": "Profile creation returned no data.",
  },
}
`);
  });

  it("returns null when update finds no rows", async () => {
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    };

    const result = await updateProfile(supabase as never, "user-1", "Ada");
    expect(result).toMatchInlineSnapshot(`
{
  "data": null,
  "error": null,
}
`);
  });
});
