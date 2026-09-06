import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid session means the reset link expired or was already used.
  if (!user) redirect("/login?error=invalid_link");

  return <ResetPasswordForm />;
}
