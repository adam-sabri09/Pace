"use server";
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type DeleteAccountState = { ok: false; error: string } | null;

export async function deleteAccountAction(
  _prev: DeleteAccountState,
  _formData: FormData,
): Promise<DeleteAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[deleteAccountAction] deleteUser error:", error.message);
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
