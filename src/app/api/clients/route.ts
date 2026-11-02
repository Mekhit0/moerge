import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
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
    // Characters with meaning in the filter syntax are removed so a search cannot change the query.
    const safeSearch = search.replace(/[%_,()*\\"]/g, "").slice(0, 80);
    const digits = safeSearch.replace(/\D/g, "");
    const terms = [`full_name.ilike.%${safeSearch}%`, `email.ilike.%${safeSearch}%`, `phone.ilike.%${safeSearch}%`];
    // "555 11 22" should find "+995555112233": compare digits against the normalized phone too.
    if (digits.length >= 3) terms.push(`normalized_phone.ilike.%${digits}%`);
    if (safeSearch) query = query.or(terms.join(","));
  }

  const limit = Number(searchParams.get("limit"));
  if (Number.isInteger(limit) && limit > 0 && limit <= 200) query = query.limit(limit);

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
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });

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

  const normalized = parsed.data.email ? normalizeEmail(parsed.data.email) : null;

  if (parsed.data.preferred_staff_id) {
    const { data: member } = await ctx.supabase.from("staff").select("id")
      .eq("id", parsed.data.preferred_staff_id).eq("salon_id", ctx.salonId).maybeSingle();
    if (!member) return NextResponse.json({ error: "სპეციალისტი ვერ მოიძებნა. / Specialist not found." }, { status: 404 });
  }

  const { data: existingClient } = await ctx.supabase
    .from("clients")
    .select("id, full_name, is_archived")
    .eq("salon_id", ctx.salonId)
    .eq("normalized_phone", parsed.data.phone)
    .maybeSingle();

  if (existingClient) {
    return NextResponse.json(
      {
        error: existingClient.is_archived
          ? `ეს ნომერი უკვე აქვს არქივში მყოფ კლიენტს: ${existingClient.full_name}. / This number belongs to an archived client: ${existingClient.full_name}.`
          : `ეს ნომერი უკვე აქვს კლიენტს: ${existingClient.full_name}. / This number already belongs to ${existingClient.full_name}.`,
        client_id: existingClient.id,
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
      sms_consent: parsed.data.sms_consent,
      sms_marketing_consent: parsed.data.sms_marketing_consent,
      sms_marketing_consent_at: parsed.data.sms_marketing_consent ? new Date().toISOString() : null,
      preferred_language: parsed.data.preferred_language,
      birthday: parsed.data.birthday,
      preferred_staff_id: parsed.data.preferred_staff_id,
      unsubscribed_at: parsed.data.email_consent ? null : new Date().toISOString(),
      sms_unsubscribed_at: parsed.data.sms_consent ? null : new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "ამ ნომრით ან ელ-ფოსტით კლიენტი უკვე არსებობს. / A client with this phone or email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: created }, { status: 201 });
}
