import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { clientInputSchema, normalizeEmail } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim();
  const filter = searchParams.get("filter") ?? "active"; // 'active' | 'archived' | 'all'

  let query = ctx.supabase
    .from("clients")
    .select("*")
    .eq("salon_id", ctx.salonId)
    .order("created_at", { ascending: false });

  if (filter === "active") {
    query = query.eq("is_archived", false);
  } else if (filter === "archived") {
    query = query.eq("is_archived", true);
  }

  if (search) {
    const safeSearch = search.replace(/[%_]/g, "");
    query = query.or(
      `full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`clients:create:${ctx.user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before adding more clients." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = clientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid client information.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const normalized = normalizeEmail(parsed.data.email);

  // Check for existing duplicate email within the same salon
  const { data: existingClient } = await ctx.supabase
    .from("clients")
    .select("id, full_name, is_archived")
    .eq("salon_id", ctx.salonId)
    .eq("normalized_email", normalized)
    .maybeSingle();

  if (existingClient) {
    return NextResponse.json(
      {
        error: existingClient.is_archived
          ? `A client with email "${normalized}" (${existingClient.full_name}) already exists in your archived clients. Restore their profile instead of creating a duplicate.`
          : `A client with email "${normalized}" (${existingClient.full_name}) is already registered in this salon.`,
      },
      { status: 409 }
    );
  }

  const { data: created, error } = await ctx.supabase
    .from("clients")
    .insert({
      salon_id: ctx.salonId, // Always scoped from server-verified salon membership
      full_name: parsed.data.full_name,
      email: normalized,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      email_consent: parsed.data.email_consent,
      unsubscribed_at: parsed.data.email_consent ? null : new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A client with this email address already exists in your salon." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: created }, { status: 201 });
}
