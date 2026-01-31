import { describe, expect, it } from "vitest";

import { statsQuerySchema } from "@/lib/validation/stats.schema";

describe("stats.schema", () => {
  it("defaults stats scope to global", () => {
    const result = statsQuerySchema.parse({});
    expect(result).toMatchInlineSnapshot(`
{
  "scope": "global",
}
`);
  });

  it("rejects invalid scope values", () => {
    const parsed = statsQuerySchema.safeParse({ scope: "team" });
    expect(parsed.success).toBe(false);
  });
});
