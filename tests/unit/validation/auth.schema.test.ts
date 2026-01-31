import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validation/auth.schema";

describe("auth.schema", () => {
  it("validates login schema required fields and email format", () => {
    const valid = loginSchema.safeParse({ email: "user@example.com", password: "pass" });
    expect(valid.success).toBe(true);

    const invalid = loginSchema.safeParse({ email: "bad-email", password: "" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.flatten().fieldErrors).toMatchInlineSnapshot(`
{
  "email": [
    "email must be valid.",
  ],
  "password": [
    "password is required.",
  ],
}
`);
    }
  });

  it("enforces register password rules and matching confirmation", () => {
    const mismatch = registerSchema.safeParse({
      email: "user@example.com",
      password: "secret1",
      confirmPassword: "secret2",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.flatten().fieldErrors).toMatchInlineSnapshot(`
{
  "confirmPassword": [
    "passwords do not match.",
  ],
}
`);
    }

    const tooShort = registerSchema.safeParse({
      email: "user@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(tooShort.success).toBe(false);

    const ok = registerSchema.safeParse({
      email: "user@example.com",
      password: "longenough",
      confirmPassword: "longenough",
    });
    expect(ok.success).toBe(true);
  });
});
