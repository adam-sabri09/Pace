import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

/**
 * /signup — public entry point. If the user is already authenticated, we
 * bounce them straight to /today so they don't see the form.
 */
export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/today");

  return <SignupForm />;
}
