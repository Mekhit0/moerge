import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { clientInputSchema, normalizeEmail } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: client, error: clientError } = await ctx.supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { data: appointments } = await ctx.supabase
    .from("appointments")
    .select("*, reminders(*)")
    .eq("client_id", id)
    .eq("salon_id", ctx.salonId)
    .order("treatment_date", { ascending: false });

  const { data: emailLogs } = await ctx.supabase
    .from("email_logs")
    .select("*")
    .eq("client_id", id)
    .eq("salon_id", ctx.salonId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    client,
    appointments: appointments ?? [],
    emailLogs: emailLogs ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: existing } = await ctx.supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Handle archive / restore toggle if requested
  if (typeof body.is_archived === "boolean" && Object.keys(body).length === 1) {
    if (!requireRole(ctx, ["owner", "admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const archiveFlag = body.is_archived;
    const { data: updated, error } = await ctx.supabase
      .from("clients")
      .update({
        is_archived: archiveFlag,
        archived_at: archiveFlag ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("salon_id", ctx.salonId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If archiving client, automatically cancel any pending scheduled reminders
    if (archiveFlag) {
      await ctx.supabase
        .from("reminders")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          cancel_reason: "Client archived by salon staff",
        })
        .eq("client_id", id)
        .eq("salon_id", ctx.salonId)
        .eq("status", "scheduled");
    }

    return NextResponse.json({ client: updated });
  }

  const parsed = clientInputSchema.safeParse({
    full_name: body.full_name ?? existing.full_name,
    email: body.email !== undefined ? body.email : existing.email,
    phone: body.phone !== undefined ? body.phone : existing.phone,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    email_consent:
      typeof body.email_consent === "boolean"
        ? body.email_consent
        : existing.email_consent,
    sms_consent:
      typeof body.sms_consent === "boolean"
        ? body.sms_consent
        : existing.sms_consent,
    preferred_language:
      body.preferred_language === "ka" || body.preferred_language === "en"
        ? body.preferred_language
        : existing.preferred_language,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid client input." },
      { status: 400 }
    );
  }

  const normalized = parsed.data.email ? normalizeEmail(parsed.data.email) : null;

  if (parsed.data.phone !== existing.normalized_phone) {
    const { data: dup } = await ctx.supabase
      .from("clients")
      .select("id, full_name")
      .eq("salon_id", ctx.salonId)
      .eq("normalized_phone", parsed.data.phone)
      .neq("id", id)
      .maybeSingle();

    if (dup) {
      return NextResponse.json(
        {
          error: `Another client (${dup.full_name}) already uses this phone number.`,
        },
        { status: 409 }
      );
    }
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from("clients")
    .update({
      full_name: parsed.data.full_name,
      email: normalized,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      email_consent: parsed.data.email_consent,
      sms_consent: parsed.data.sms_consent,
      preferred_language: parsed.data.preferred_language,
      unsubscribed_at: parsed.data.email_consent
        ? null
        : existing.unsubscribed_at ?? new Date().toISOString(),
      sms_unsubscribed_at: parsed.data.sms_consent
        ? null
        : existing.sms_unsubscribed_at ?? new Date().toISOString(),
    })
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If consent was withdrawn, cancel pending reminders
  if (!parsed.data.email_consent) {
    await ctx.supabase
      .from("reminders")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: "Client email consent disabled",
      })
      .eq("client_id", id)
      .eq("salon_id", ctx.salonId)
      .eq("status", "scheduled");
  }
  if (!parsed.data.sms_consent) {
    await ctx.supabase
      .from("notification_log")
      .update({ status: "suppressed", error: "SMS consent withdrawn" })
      .eq("client_id", id)
      .eq("salon_id", ctx.salonId)
      .eq("channel", "sms")
      .in("status", ["pending", "retry"]);
  }

  return NextResponse.json({ client: updated });
}
