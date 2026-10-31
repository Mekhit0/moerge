import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { newInviteToken, sendInviteEmail } from "@/lib/team";
import { appUrl } from "@/lib/app-url";

const office = ["owner", "admin"] as const;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "staff"]),
  staff_id: z.string().uuid().nullable().optional(),
});

const memberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "staff"]),
  is_active: z.boolean(),
});

/** Maps database errors from the team functions to a bilingual message and status. */
function teamError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "42501": return { status: 403, error: "ამის უფლება არ გაქვთ. / You are not allowed to do this." };
    case "23505": return { status: 409, error: error.message?.includes("member")
      ? "ეს ელ-ფოსტა უკვე გუნდშია. / This email is already on the team."
      : "ეს უკვე გაკეთებულია. / This is already done." };
    case "P0002": return { status: 404, error: "სპეციალისტი ვერ მოიძებნა ან უკვე აქვს შესვლა. / Specialist not found or already has a login." };
    case "23514": return { status: 400, error: "სპეციალისტის როლისთვის ჯერ მიაბით სპეციალისტი. / Link a specialist first." };
    default: return { status: 400, error: "ცვლილება ვერ შეინახა. / The change could not be saved." };
  }
}

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, office)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [members, staff, invites] = await Promise.all([
    ctx.supabase.from("salon_memberships").select("user_id,role,is_active,created_at,profile:user_profiles(full_name,email)")
      .eq("salon_id", ctx.salonId).order("created_at"),
    ctx.supabase.from("staff").select("id,full_name,color,user_id,is_active").eq("salon_id", ctx.salonId).order("sort_order"),
    ctx.supabase.from("team_invites").select("id,email,role,staff_id,expires_at,created_at")
      .eq("salon_id", ctx.salonId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  if (members.error || staff.error || invites.error) return NextResponse.json({ error: "Could not load the team." }, { status: 500 });

  return NextResponse.json({
    me: { user_id: ctx.user.id, role: ctx.role },
    members: (members.data ?? []).map((row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return { user_id: row.user_id, role: row.role, is_active: row.is_active, full_name: profile?.full_name ?? "", email: profile?.email ?? "" };
    }),
    staff: staff.data ?? [],
    invites: invites.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, office)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "შეამოწმეთ ელ-ფოსტა და როლი. / Check the email and role." }, { status: 400 });
  if (parsed.data.role === "staff" && !parsed.data.staff_id) {
    return NextResponse.json({ error: "აირჩიეთ სპეციალისტი. / Choose the specialist." }, { status: 400 });
  }

  if (!(await consumeServerRateLimit(createServiceClient(), `team-invite:${ctx.salonId}`, 30, 86400))) {
    return NextResponse.json({ error: "დღეს ძალიან ბევრი მოწვევაა. სცადეთ ხვალ. / Too many invites today. Try tomorrow." }, { status: 429 });
  }

  const { token, hash } = newInviteToken();
  const { data: inviteId, error } = await ctx.supabase.rpc("create_team_invite", {
    p_salon_id: ctx.salonId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_staff_id: parsed.data.role === "staff" ? parsed.data.staff_id : null,
    p_token_hash: hash,
  });
  if (error) {
    const mapped = teamError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const link = appUrl(`/invite/${token}`);
  const emailed = await sendInviteEmail({
    to: parsed.data.email,
    salonName: ctx.settings.salon_name || ctx.salonName,
    role: parsed.data.role,
    link,
    idempotencyKey: `team-invite-${inviteId}`,
  });
  return NextResponse.json({ invite_id: inviteId, link, emailed }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, office)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invite id is required." }, { status: 400 });
  const { error } = await ctx.supabase.rpc("revoke_team_invite", { p_invite_id: id });
  if (error) {
    const mapped = teamError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner"])) return NextResponse.json({ error: "მხოლოდ მფლობელს შეუძლია. / Only the owner can do this." }, { status: 403 });
  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await ctx.supabase.rpc("update_team_member", {
    p_salon_id: ctx.salonId,
    p_user_id: parsed.data.user_id,
    p_role: parsed.data.role,
    p_is_active: parsed.data.is_active,
  });
  if (error) {
    const mapped = teamError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
  return NextResponse.json({ success: true });
}
