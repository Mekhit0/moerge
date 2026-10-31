import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"), "/onboarding");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // A failed password-reset link sends the user back to request a new one.
  if (next === "/reset-password") {
    return NextResponse.redirect(new URL("/login?reset=expired", requestUrl.origin));
  }
  return NextResponse.redirect(new URL("/login?confirmed=true", requestUrl.origin));
}
