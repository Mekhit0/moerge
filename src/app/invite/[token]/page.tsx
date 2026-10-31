import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { INVITE_TOKEN_PATTERN, hashInviteToken } from "@/lib/team";
import InviteAccept from "@/components/team/InviteAccept";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "მოწვევა",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: { email: string; role: "admin" | "staff"; salonName: string; staffName: string | null } | null = null;

  if (INVITE_TOKEN_PATTERN.test(token)) {
    const service = createServiceClient();
    const { data } = await service.from("team_invites")
      .select("email,role,salon:salons(name),staff:staff(full_name)")
      .eq("token_hash", hashInviteToken(token)).is("accepted_at", null).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) {
      const salon = Array.isArray(data.salon) ? data.salon[0] : data.salon;
      const staff = Array.isArray(data.staff) ? data.staff[0] : data.staff;
      invite = { email: data.email, role: data.role as "admin" | "staff", salonName: salon?.name ?? "", staffName: staff?.full_name ?? null };
    }
  }

  return <InviteAccept token={token} invite={invite} />;
}
