import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
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
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });

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

  if (Object.keys(body).length === 1 && Array.isArray(body.tags)) {
    const tags = body.tags.map((tag) => typeof tag === "string" ? tag.trim().slice(0, 40) : "")
      .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index).slice(0, 20);
    if (tags.length !== body.tags.length) return NextResponse.json({ error: "Tags must be text, up to 20 items." }, { status: 400 });
    const { data: updated, error } = await ctx.supabase.from("clients").update({ tags })
      .eq("id", id).eq("salon_id", ctx.salonId).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: updated });
  }

  // Block or unblock online booking for this client's phone number. Blocking can also cancel
  // the client's upcoming bookings, which cleans up after someone filling the calendar.
  if (typeof body.is_blocked === "boolean" && Object.keys(body).every((key) => key === "is_blocked" || key === "cancel_upcoming")) {
    if (!requireRole(ctx, ["owner", "admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: updated, error } = await ctx.supabase.from("clients")
      .update({ is_blocked: body.is_blocked, blocked_at: body.is_blocked ? new Date().toISOString() : null })
      .eq("id", id).eq("salon_id", ctx.salonId).select("*").single();
    if (error) return NextResponse.json({ error: "Could not update the client." }, { status: 500 });

    let canceled = 0;
    if (body.is_blocked && body.cancel_upcoming === true) {
      const { data: canceledRows, error: cancelError } = await ctx.supabase.from("appointments")
        .update({ status: "canceled" })
        .eq("salon_id", ctx.salonId).eq("client_id", id).eq("status", "scheduled")
        .gt("starts_at", new Date().toISOString())
        .select("id");
      if (cancelError) return NextResponse.json({ error: "The client is blocked, but upcoming bookings could not be canceled." }, { status: 500 });
      canceled = canceledRows?.length ?? 0;
    }
    return NextResponse.json({ client: updated, canceled });
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
    sms_marketing_consent:
      typeof body.sms_marketing_consent === "boolean"
        ? body.sms_marketing_consent
        : existing.sms_marketing_consent,
    preferred_language:
      body.preferred_language === "ka" || body.preferred_language === "en"
        ? body.preferred_language
        : existing.preferred_language,
    birthday: body.birthday !== undefined ? body.birthday : existing.birthday,
    preferred_staff_id: body.preferred_staff_id !== undefined ? body.preferred_staff_id : existing.preferred_staff_id,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid client input." },
      { status: 400 }
    );
  }

  const normalized = parsed.data.email ? normalizeEmail(parsed.data.email) : null;

  if (parsed.data.preferred_staff_id && parsed.data.preferred_staff_id !== existing.preferred_staff_id) {
    const { data: member } = await ctx.supabase.from("staff").select("id")
      .eq("id", parsed.data.preferred_staff_id).eq("salon_id", ctx.salonId).maybeSingle();
    if (!member) return NextResponse.json({ error: "სპეციალისტი ვერ მოიძებნა. / Specialist not found." }, { status: 404 });
  }

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
          error: `ეს ნომერი უკვე აქვს კლიენტს: ${dup.full_name}. / Another client (${dup.full_name}) already uses this number.`,
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
      sms_marketing_consent: parsed.data.sms_marketing_consent,
      // Keep when consent was first given; clear it when withdrawn.
      sms_marketing_consent_at: parsed.data.sms_marketing_consent
        ? existing.sms_marketing_consent_at ?? new Date().toISOString()
        : null,
      preferred_language: parsed.data.preferred_language,
      birthday: parsed.data.birthday,
      preferred_staff_id: parsed.data.preferred_staff_id,
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
