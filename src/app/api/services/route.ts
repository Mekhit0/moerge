import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const canManage = ["owner", "admin"] as const;

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.from("services").select("*").eq("salon_id", ctx.salonId).order("name_ka");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name_ka !== "string" || body.name_ka.trim().length < 2) return NextResponse.json({ error: "მიუთითეთ სერვისის სახელი ქართულად. / Enter the service name in Georgian." }, { status: 400 });
  const nameKa = body.name_ka.trim();
  const staffIds = Array.isArray(body.staff_ids) ? [...new Set(body.staff_ids.filter((id): id is string => typeof id === "string"))] : [];
  if (!staffIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სერვისის მინიმუმ ერთი სპეციალისტი. / Choose at least one specialist for this service." }, { status: 400 });
  const { data: assignedStaff, error: staffError } = await ctx.supabase.from("staff")
    .select("id").eq("salon_id", ctx.salonId).eq("is_active", true).in("id", staffIds);
  if (staffError || assignedStaff?.length !== staffIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სალონის აქტიური სპეციალისტები. / Choose active specialists from this salon." }, { status: 400 });
  const { data, error } = await ctx.supabase.from("services").insert({
    salon_id: ctx.salonId, name_ka: nameKa, name_en: nameKa,
    price_gel: Number(body.price_gel ?? 0), duration_minutes: Number(body.duration_minutes ?? 45),
    buffer_minutes: Number(body.buffer_minutes ?? 0), category: typeof body.category === "string" ? body.category : "general",
    recall_days: body.recall_days === null || body.recall_days === "" ? null : Number(body.recall_days ?? null),
    is_online_bookable: body.is_online_bookable !== false,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: assignmentError } = await ctx.supabase.from("staff_services").insert(staffIds.map((staff_id) => ({ salon_id: ctx.salonId, staff_id, service_id: data.id })));
  if (assignmentError) {
    await ctx.supabase.from("services").update({ is_active: false, is_online_bookable: false }).eq("id", data.id).eq("salon_id", ctx.salonId);
    return NextResponse.json({ error: "სერვისის სპეციალისტებზე მინიჭება ვერ მოხერხდა. / Could not assign the service to specialists." }, { status: 500 });
  }
  return NextResponse.json({ service: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  const editable = ["name_ka", "name_en", "price_gel", "duration_minutes", "buffer_minutes", "category", "recall_days", "is_active", "is_online_bookable"];
  const update = Object.fromEntries(editable.filter((key) => key in body).map((key) => [key, body[key]]));
  const { data, error } = await ctx.supabase.from("services").update(update).eq("id", body.id).eq("salon_id", ctx.salonId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ service: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  const { error } = await ctx.supabase.from("services").update({ is_active: false, is_online_bookable: false }).eq("id", id).eq("salon_id", ctx.salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
