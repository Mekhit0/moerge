import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const canManage = ["owner", "admin"] as const;

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.from("services").select("*, staff_services(staff_id)").eq("salon_id", ctx.salonId).order("name_ka");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: (data ?? []).map(({ staff_services, ...service }) => ({ ...service, staff_ids: staff_services.map((assignment: { staff_id: string }) => assignment.staff_id) })) });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name_ka !== "string" || body.name_ka.trim().length < 2) return NextResponse.json({ error: "მიუთითეთ სერვისის სახელი ქართულად. / Enter the service name in Georgian." }, { status: 400 });
  const nameKa = body.name_ka.trim();
  const staffIds = Array.isArray(body.staff_ids) ? [...new Set(body.staff_ids.filter((id): id is string => typeof id === "string"))] : [];
  if (!staffIds.length) {
    const { count, error } = await ctx.supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true);
    if (error) return NextResponse.json({ error: "სპეციალისტების სიის წაკითხვა ვერ მოხერხდა. / Could not load specialists." }, { status: 500 });
    if ((count ?? 0) > 0) return NextResponse.json({ error: "მიუთითეთ, რომელი სპეციალისტი ასრულებს ამ სერვისს. / Choose which specialist performs this service." }, { status: 400 });
  }
  if (staffIds.length) {
    const { data: assignedStaff, error: staffError } = await ctx.supabase.from("staff")
      .select("id").eq("salon_id", ctx.salonId).eq("is_active", true).in("id", staffIds);
    if (staffError || assignedStaff?.length !== staffIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სალონის აქტიური სპეციალისტები. / Choose active specialists from this salon." }, { status: 400 });
  }
  const { data, error } = await ctx.supabase.from("services").insert({
    salon_id: ctx.salonId, name_ka: nameKa, name_en: nameKa,
    price_gel: Number(body.price_gel ?? 0), duration_minutes: Number(body.duration_minutes ?? 45),
    buffer_minutes: Number(body.buffer_minutes ?? 0), category: typeof body.category === "string" ? body.category : "general",
    recall_days: body.recall_days === null || body.recall_days === "" ? null : Number(body.recall_days ?? null),
    is_online_bookable: body.is_online_bookable !== false,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: assignmentError } = staffIds.length
    ? await ctx.supabase.from("staff_services").insert(staffIds.map((staff_id) => ({ salon_id: ctx.salonId, staff_id, service_id: data.id })))
    : { error: null };
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
  const update: Record<string, unknown> = {};
  if ("name_ka" in body) {
    if (typeof body.name_ka !== "string" || body.name_ka.trim().length < 2 || body.name_ka.trim().length > 150) return NextResponse.json({ error: "მიუთითეთ სერვისის სახელი. / Enter the service name." }, { status: 400 });
    update.name_ka = body.name_ka.trim();
    update.name_en = body.name_ka.trim();
  }
  const number = (key: string, min: number, max: number) => {
    const value = Number(body[key]);
    return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
  };
  for (const [key, min, max] of [["price_gel", 0, 100000], ["duration_minutes", 5, 720], ["buffer_minutes", 0, 240]] as const) {
    if (!(key in body)) continue;
    const value = number(key, min, max);
    if (value === undefined) return NextResponse.json({ error: `Invalid ${key}.` }, { status: 400 });
    update[key] = key === "price_gel" ? value : Math.round(value);
  }
  if ("recall_days" in body) {
    if (body.recall_days === null || body.recall_days === "") update.recall_days = null;
    else {
      const value = number("recall_days", 1, 365);
      if (value === undefined) return NextResponse.json({ error: "Invalid recall_days." }, { status: 400 });
      update.recall_days = Math.round(value);
    }
  }
  for (const key of ["is_active", "is_online_bookable"]) if (typeof body[key] === "boolean") update[key] = body[key];
  if (typeof body.category === "string") update.category = body.category.slice(0, 60);

  const staffIds = Array.isArray(body.staff_ids) ? [...new Set(body.staff_ids.filter((id): id is string => typeof id === "string"))] : null;
  if (staffIds?.length) {
    const { data: found } = await ctx.supabase.from("staff").select("id").eq("salon_id", ctx.salonId).in("id", staffIds);
    if (found?.length !== staffIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სალონის სპეციალისტები. / Choose specialists from this salon." }, { status: 400 });
  }
  const { data, error } = Object.keys(update).length
    ? await ctx.supabase.from("services").update(update).eq("id", body.id).eq("salon_id", ctx.salonId).select("*").maybeSingle()
    : await ctx.supabase.from("services").select("*").eq("id", body.id).eq("salon_id", ctx.salonId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  if (staffIds) {
    // Replace who performs the service with the chosen specialists.
    const { error: clearError } = await ctx.supabase.from("staff_services").delete().eq("salon_id", ctx.salonId).eq("service_id", data.id);
    const { error: addError } = clearError || !staffIds.length ? { error: clearError } : await ctx.supabase.from("staff_services").insert(staffIds.map((staff_id) => ({ salon_id: ctx.salonId, staff_id, service_id: data.id })));
    if (clearError || addError) return NextResponse.json({ error: "სპეციალისტების შენახვა ვერ მოხერხდა. / Could not save the specialists." }, { status: 500 });
  }
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
