import { describe, expect, it } from "vitest";

import { createTeamSchema } from "@/lib/validation/team.schema";

describe("team.schema", () => {
  it("requires name and enforces length limits", () => {
    const empty = createTeamSchema.safeParse({ name: "" });
    expect(empty.success).toBe(false);

    const tooLong = createTeamSchema.safeParse({ name: "x".repeat(101) });
    expect(tooLong.success).toBe(false);

    const ok = createTeamSchema.safeParse({ name: "On-Call Team" });
    expect(ok.success).toBe(true);
  });
});
