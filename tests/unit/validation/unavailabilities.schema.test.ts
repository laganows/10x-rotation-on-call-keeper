import { describe, expect, it } from "vitest";

import {
  unavailabilitiesCreateQuerySchema,
  unavailabilitiesListQuerySchema,
} from "@/lib/validation/unavailabilities.schema";

describe("unavailabilities.schema", () => {
  it("requires start/end dates for list query and applies defaults", () => {
    const ok = unavailabilitiesListQuerySchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2024-01-02",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toMatchInlineSnapshot(`
{
  "endDate": "2024-01-02",
  "limit": 50,
  "memberId": undefined,
  "offset": 0,
  "order": "asc",
  "sort": "day",
  "startDate": "2024-01-01",
}
`);
    }

    const missing = unavailabilitiesListQuerySchema.safeParse({ startDate: "2024-01-01" });
    expect(missing.success).toBe(false);
  });

  it("defaults onConflict to error for create query", () => {
    const result = unavailabilitiesCreateQuerySchema.parse({});
    expect(result).toMatchInlineSnapshot(`
{
  "onConflict": "error",
}
`);
  });
});
