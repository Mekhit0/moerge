import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const updateSchema = z.object({
  id: z.string().uuid(),
  subject_template: z.string().max(200).nullable().optional(),
  body_template: z.string().trim().min(1).max(4000),
  is_active: z.boolean(),
});

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await ctx.supabase.from("notification_templates").select("*")
    .eq("salon_id", ctx.salonId).order("message_type").order("channel").order("language");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid template." }, { status: 400 });
  const { data: target } = await ctx.supabase.from("notification_templates")
    .select("channel").eq("id", parsed.data.id).eq("salon_id", ctx.salonId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (!parsed.data.body_template.includes("{{unsubscribe_link}}")) {
    return NextResponse.json({ error: "Keep the {{unsubscribe_link}} placeholder so clients can opt out." }, { status: 422 });
  }
  const { data, error } = await ctx.supabase.from("notification_templates")
    .update({
      subject_template: parsed.data.subject_template,
      body_template: parsed.data.body_template,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id).eq("salon_id", ctx.salonId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template: data });
}
