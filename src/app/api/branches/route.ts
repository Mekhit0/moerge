import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { BILLING_CONFIG, planInfo, type PaidPlan } from "@/lib/billing-plans";

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.from("salon_branches").select("id,name,is_active,created_at").eq("salon_id", ctx.salonId).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branches: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
  const db = createServiceClient();
  const [{ data: subscription }, { count }] = await Promise.all([
    db.from("subscriptions").select("plan_code,status").eq("salon_id", ctx.salonId).maybeSingle(),
    db.from("salon_branches").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true),
  ]);
  if (subscription?.status !== "active") return NextResponse.json({ error: "Branch changes are available after plan activation." }, { status: 402 });
  const plan = (subscription?.plan_code ?? "business") as PaidPlan;
  const cap = plan === "multi_branch" ? BILLING_CONFIG.maxActiveBranches : planInfo(plan).branches;
  if ((count ?? 0) >= cap) return NextResponse.json({ error: `This plan allows up to ${cap} active branch(es).` }, { status: 422 });
  const { data, error } = await db.from("salon_branches").insert({ salon_id: ctx.salonId, name: parsed.data.name }).select("id,name,is_active,created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const billableBranches = Math.max(0, (count ?? 0) + 1 - planInfo(plan).branches);
  return NextResponse.json({ branch: data, addedMonthlyChargeGel: billableBranches > 0 ? BILLING_CONFIG.extraBranchMonthlyGel : 0 }, { status: 201 });
}

