import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedSalonContext,
} from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: reminder } = await ctx.supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (!reminder) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string | undefined;

  if (action === "cancel") {
    if (reminder.status !== "scheduled") {
      return NextResponse.json(
        { error: `Cannot cancel a reminder with status "${reminder.status}".` },
        { status: 400 }
      );
    }

    const reason =
      typeof body.cancel_reason === "string" && body.cancel_reason.trim()
        ? body.cancel_reason.trim()
        : "Canceled manually by salon staff";

    const { data: canceled, error } = await ctx.supabase
      .from("reminders")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: reason,
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("salon_id", ctx.salonId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder: canceled });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

/** Legacy reminder rows were replaced by the multi-channel notification outbox. */
export async function POST() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Legacy reminders are read-only. Notification delivery and retries run automatically." },
    { status: 410 }
  );
}
