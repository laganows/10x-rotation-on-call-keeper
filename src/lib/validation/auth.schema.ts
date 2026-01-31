import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().min(1, "email is required.").email("email must be valid."),
    password: z.string().min(1, "password is required."),
  })
  .strict();

export const registerSchema = z
  .object({
    email: z.string().trim().min(1, "email is required.").email("email must be valid."),
    password: z.string().min(6, "password must be at least 6 characters."),
    confirmPassword: z.string().min(1, "confirm password is required."),
  })
  .strict()
  .refine((values) => values.password === values.confirmPassword, {
    message: "passwords do not match.",
    path: ["confirmPassword"],
  });
