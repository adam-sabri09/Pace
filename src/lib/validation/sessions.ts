import { z } from "zod";

/**
 * Server-action input schemas for Complete / Missed on a session card.
 * The UUID shape matches Postgres's gen_random_uuid() output.
 */
export const SessionIdSchema = z.object({
  sessionId: z
    .string({ error: "Session id is required." })
    .uuid("Invalid session id."),
});
export type SessionIdInput = z.infer<typeof SessionIdSchema>;
