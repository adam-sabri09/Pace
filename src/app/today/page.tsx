import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logOutAction } from "@/server/actions/auth";

/**
 * /today — placeholder authenticated landing.
 *
 * Step 3 scope: prove the auth round-trip works end-to-end. Real dashboard
 * content (session cards, exam widget, nav shell) is built in Step 5.
 * Keep this file intentionally minimal so it doesn't collect UI debt.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const greetingName = profile?.first_name?.trim() || "friend";

  return (
    <main className="min-h-full flex-grow flex items-center justify-center px-container-margin py-stack-lg">
      <div className="w-full max-w-md flex flex-col items-center gap-stack-md text-center">
        <span className="font-display text-headline-md text-primary">Pace</span>
        <h1 className="font-display text-headline-lg-mobile md:text-headline-lg text-on-surface">
          You&rsquo;re signed in, {greetingName}.
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Your dashboard is coming next. This is the placeholder landing that
          confirms your account works.
        </p>
        <form action={logOutAction}>
          <button
            type="submit"
            className="border border-outline-variant text-on-surface font-label-md text-label-md px-8 py-3 rounded-lg hover:bg-surface-container-low transition-colors mt-stack-md"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
