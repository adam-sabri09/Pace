import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

// Routes that are public (no auth required).
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/auth/callback"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow Next.js internals and static assets.
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) return true;
  // Google OAuth API routes are called server-side; they validate auth themselves.
  if (pathname.startsWith("/api/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  // Always refresh session cookies first (required by @supabase/ssr).
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Build a lightweight Supabase client to read the current user.
  // We re-use the already-refreshed cookies from the response object.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Cookies were already set in updateSession; nothing extra needed.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated user on a protected route → send to login.
  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to reach login/signup → send to today.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const todayUrl = request.nextUrl.clone();
    todayUrl.pathname = "/today";
    return NextResponse.redirect(todayUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match every path except static files and Next.js internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
