"use server";

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function clearAppErrorsAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = createServiceClient();
  const { error } = await db.from("app_errors").delete().not("id", "is", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
