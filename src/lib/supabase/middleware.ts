import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { CookieOptions } from "@supabase/ssr";
import { resolveFeatureKey } from "@/lib/features";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    // No user, redirect to login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Check if user is admin + charge ses restrictions d'accès en une seule query.
    // Le `!profile_id` est obligatoire : admin_disabled_features a 2 FK vers
    // profiles (profile_id et created_by), l'embed serait ambigu sinon.
    const { data: profile } = await (supabase
      .from("profiles") as any)
      .select("role, is_super_admin, admin_disabled_features!profile_id(feature_key)")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isSuperAdmin = isAdmin && profile?.is_super_admin === true;

    if (!isAdmin && !isPublicRoute) {
      // Not an admin, redirect to login with error
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }

    if (isAdmin && request.nextUrl.pathname === "/login") {
      // Admin is logged in, redirect to dashboard
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (isAdmin && !isSuperAdmin) {
      const pathname = request.nextUrl.pathname;

      // Blocage dur des fonctionnalités désactivées pour cet admin.
      // (La gestion des accès elle-même — onglet Administrateurs de /settings —
      // est masquée côté client et protégée en écriture par la RLS.)
      const disabled = new Set<string>(
        (profile?.admin_disabled_features ?? []).map(
          (f: { feature_key: string }) => f.feature_key
        )
      );
      const featureKey = resolveFeatureKey(pathname);

      if (featureKey !== null && disabled.has(featureKey)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        url.searchParams.set("error", "feature_disabled");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
