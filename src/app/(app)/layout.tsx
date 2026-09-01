import { redirect } from "next/navigation";

import { BottomNav, SideNav, TopAppBar } from "@/components/nav/shell";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated shell applied to /today, /plan, /subjects, /settings, /admin.
 * The onboarding route stays outside this group (focus screen, no nav).
 * A single server-side auth check gates every child route here.
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

  // Temporarily: all authenticated users have admin access.
  const isAdmin = true;

  return (
    <div className="min-h-full flex flex-col md:flex-row bg-background text-on-surface">
      <SideNav isAdmin={isAdmin} />
      <TopAppBar />
      <div className="w-full min-h-full md:pl-64 flex flex-col">
        <div className="pt-14 md:pt-0 pb-24 md:pb-0 flex-grow flex flex-col">
          {children}
        </div>
      </div>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
