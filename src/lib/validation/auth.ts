import { z } from "zod";

/**
 * Zod schemas for the auth surface. Shared between the client form (for
 * error rendering) and the server action (as the source of truth).
 *
 * All fields are validated at the server boundary per API.md §"Error contract".
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} is too long.`);

export const SignUpSchema = z.object({
  firstName: trimmed(1, 50, "First name"),
  email: z.email("Enter a valid email address."),
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
  ageConfirmed13Plus: z.literal(true, {
    error: "You must confirm you are 13 or older to use Pace.",
  }),
  // IANA timezone auto-detected on the client via Intl.DateTimeFormat().
  // We accept anything non-empty here and treat missing/unknown as
  // "UTC" further down the stack.
  timeZone: z.string().trim().min(1).max(100).catch("UTC"),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const LogInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(72, "Password is too long."),
});
export type LogInInput = z.infer<typeof LogInSchema>;
