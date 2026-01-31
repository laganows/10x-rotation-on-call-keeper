import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("returns the last class when conflicts exist", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters falsy values and keeps other classes", () => {
    expect(cn("px-2", undefined, "py-1")).toBe("px-2 py-1");
  });
});
