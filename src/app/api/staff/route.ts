import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { BILLING_CONFIG, planInfo, type PaidPlan } from "@/lib/billing-plans";

const canManage = ["owner", "admin"] as const;

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.from("staff").select("*, staff_services(service_id)").eq("salon_id", ctx.salonId).order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.full_name !== "string" || body.full_name.trim().length < 2) return NextResponse.json({ error: "Staff name is required." }, { status: 400 });
  const serviceIds = Array.isArray(body.service_ids) ? [...new Set(body.service_ids.filter((id): id is string => typeof id === "string"))] : [];
  if (!serviceIds.length) {
    const { count, error } = await ctx.supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true);
    if (error) return NextResponse.json({ error: "სერვისების სიის წაკითხვა ვერ მოხერხდა. / Could not load services." }, { status: 500 });
    if ((count ?? 0) > 0) return NextResponse.json({ error: "მონიშნეთ სპეციალისტის მიერ შესრულებული სერვისი. / Select a service this specialist performs." }, { status: 400 });
  }
  if (serviceIds.length) {
    const { data: assignedServices, error: serviceError } = await ctx.supabase.from("services")
      .select("id").eq("salon_id", ctx.salonId).eq("is_active", true).in("id", serviceIds);
    if (serviceError || assignedServices?.length !== serviceIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სალონის აქტიური სერვისები. / Choose active services from this salon." }, { status: 400 });
  }
  const admin = createServiceClient();
  const [{ data: subscription }, { count: activeCount }] = await Promise.all([admin.from("subscriptions").select("plan_code,status,trial_ends_at").eq("salon_id", ctx.salonId).maybeSingle(), admin.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true)]);
  const plan = (subscription?.plan_code ?? "business") as PaidPlan;
  const allowed = subscription?.status === "trialing" ? BILLING_CONFIG.trialStaffLimit : planInfo(plan).staffLimit;
  if ((activeCount ?? 0) >= allowed) return NextResponse.json({ error: `მაქსიმუმ ${allowed} აქტიური სპეციალისტია შესაძლებელი. / This subscription allows up to ${allowed} active staff.` }, { status: 422 });
  const { data, error } = await ctx.supabase.from("staff").insert({ salon_id: ctx.salonId, full_name: body.full_name.trim(), color: typeof body.color === "string" ? body.color : "#e11d48", sort_order: Number(body.sort_order) || 0 }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: assignmentError } = serviceIds.length
    ? await ctx.supabase.from("staff_services").insert(serviceIds.map((service_id) => ({ salon_id: ctx.salonId, staff_id: data.id, service_id })))
    : { error: null };
  if (assignmentError) {
    await ctx.supabase.from("staff").update({ is_active: false }).eq("id", data.id).eq("salon_id", ctx.salonId);
    return NextResponse.json({ error: "სპეციალისტისთვის სერვისების მინიჭება ვერ მოხერხდა. / Could not assign services to the specialist." }, { status: 500 });
  }
  return NextResponse.json({ staff: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
  const allowed: Record<string, unknown> = {};
  if (typeof body.full_name === "string") allowed.full_name = body.full_name.trim();
  if (typeof body.color === "string") allowed.color = body.color;
  if (typeof body.photo_url === "string" || body.photo_url === null) allowed.photo_url = body.photo_url;
  if (typeof body.is_active === "boolean") allowed.is_active = body.is_active;
  if (Number.isInteger(body.sort_order)) allowed.sort_order = body.sort_order;
  if (allowed.is_active === true) {
    const admin = createServiceClient();
    const { data: existing } = await admin.from("staff").select("is_active").eq("id", body.id).eq("salon_id", ctx.salonId).maybeSingle();
    if (existing && !existing.is_active) {
      const [{ data: subscription }, { count }] = await Promise.all([admin.from("subscriptions").select("plan_code,status").eq("salon_id", ctx.salonId).maybeSingle(), admin.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true)]);
      const plan = (subscription?.plan_code ?? "business") as PaidPlan; const cap = subscription?.status === "trialing" ? BILLING_CONFIG.trialStaffLimit : planInfo(plan).staffLimit;
      if ((count ?? 0) >= cap) return NextResponse.json({ error: `მაქსიმუმ ${cap} აქტიური სპეციალისტია შესაძლებელი. / This subscription allows up to ${cap} active staff.` }, { status: 422 });
    }
  }
  const serviceIds = Array.isArray(body.service_ids) ? [...new Set(body.service_ids.filter((id): id is string => typeof id === "string"))] : null;
  if (serviceIds?.length) {
    const { data: found } = await ctx.supabase.from("services").select("id").eq("salon_id", ctx.salonId).in("id", serviceIds);
    if (found?.length !== serviceIds.length) return NextResponse.json({ error: "აირჩიეთ ამ სალონის სერვისები. / Choose services from this salon." }, { status: 400 });
  }
  const { data, error } = Object.keys(allowed).length
    ? await ctx.supabase.from("staff").update(allowed).eq("id", body.id).eq("salon_id", ctx.salonId).select("*").maybeSingle()
    : await ctx.supabase.from("staff").select("*").eq("id", body.id).eq("salon_id", ctx.salonId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (serviceIds) {
    // Replace the specialist's services with the chosen ones.
    const { error: clearError } = await ctx.supabase.from("staff_services").delete().eq("salon_id", ctx.salonId).eq("staff_id", data.id);
    const { error: addError } = clearError || !serviceIds.length ? { error: clearError } : await ctx.supabase.from("staff_services").insert(serviceIds.map((service_id) => ({ salon_id: ctx.salonId, staff_id: data.id, service_id })));
    if (clearError || addError) return NextResponse.json({ error: "სერვისების შენახვა ვერ მოხერხდა. / Could not save the services." }, { status: 500 });
  }
  return NextResponse.json({ staff: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
  const { error } = await ctx.supabase.from("staff").update({ is_active: false }).eq("id", id).eq("salon_id", ctx.salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
