import { redirect } from "next/navigation";

import { BottomNav, SideNav, TopAppBar } from "@/components/nav/shell";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import type { AgeBand } from "@/lib/personalization/age-band";
import { AgeBandDevSwitcher } from "@/components/dev/age-band-switcher";

/**
 * Authenticated shell applied to /today, /plan, /subjects, /settings, /admin.
 * The onboarding route stays outside this group (focus screen, no nav).
 * A single server-side auth check gates every child route here.
 *
 * data-age-band drives CSS variable overrides defined in globals.css — every
 * Tailwind color utility inside the shell resolves the correct palette for the
 * user's age band without any per-component age checks.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = isAdminEmail(user.email);

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_band")
    .eq("id", user.id)
    .maybeSingle();

  const ageBand = (profile?.age_band as AgeBand | null) ?? undefined;

  return (
    <div
      id="app-shell"
      className="min-h-full flex flex-col md:flex-row bg-background text-on-surface"
      data-age-band={ageBand}
    >
      <SideNav isAdmin={isAdmin} />
      <TopAppBar />
      <div className="w-full min-h-full md:pl-64 flex flex-col">
        <div className="pt-14 md:pt-0 pb-24 md:pb-0 flex-grow flex flex-col">
          {children}
        </div>
      </div>
      <BottomNav isAdmin={isAdmin} />
      {process.env.NODE_ENV !== "production" && (
        <AgeBandDevSwitcher realBand={ageBand} />
      )}
    </div>
  );
}
