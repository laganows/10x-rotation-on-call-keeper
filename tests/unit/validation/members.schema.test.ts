import { describe, expect, it } from "vitest";

import { createMemberSchema, membersListQuerySchema } from "@/lib/validation/members.schema";

describe("members.schema", () => {
  it("requires displayName and enforces length limits", () => {
    const empty = createMemberSchema.safeParse({ displayName: "" });
    expect(empty.success).toBe(false);

    const tooLong = createMemberSchema.safeParse({ displayName: "x".repeat(101) });
    expect(tooLong.success).toBe(false);

    const ok = createMemberSchema.safeParse({ displayName: "Jane Doe" });
    expect(ok.success).toBe(true);
  });

  it("applies defaults and clamps pagination for members list", () => {
    const result = membersListQuerySchema.parse({});
    expect(result).toMatchInlineSnapshot(`
{
  "limit": 50,
  "offset": 0,
  "order": "desc",
  "sort": "createdAt",
  "status": "active",
}
`);
  });

  it("sets order based on sort when order is missing", () => {
    const result = membersListQuerySchema.parse({ sort: "displayName" });
    expect(result.order).toBe("asc");
  });

  it("preprocesses numbers from strings and clamps limits", () => {
    const result = membersListQuerySchema.parse({
      limit: " 250 ",
      offset: "-5",
    });
    expect(result.limit).toBe(200);
    expect(result.offset).toBe(0);
  });

  it("rejects invalid numeric values", () => {
    const parsed = membersListQuerySchema.safeParse({ limit: "nope" });
    expect(parsed.success).toBe(false);
  });
});
