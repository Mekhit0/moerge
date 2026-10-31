import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { INVITE_TOKEN_PATTERN, hashInviteToken } from "@/lib/team";

const acceptSchema = z.object({
  token: z.string().regex(INVITE_TOKEN_PATTERN),
  full_name: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(72),
});

const INVALID = "მოწვევის ბმული აღარ მოქმედებს. სთხოვეთ სალონს ახალი. / This invite link no longer works. Ask the salon for a new one.";

/**
 * POST /api/team/accept
 * Creates the invited person's login with the invited email and joins them to the salon in one step.
 * The secret link token is the proof; it is checked before and inside the database function.
 */
export async function POST(request: NextRequest) {
  const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "შეავსეთ სახელი და პაროლი (მინიმუმ 8 სიმბოლო). / Enter your name and a password of at least 8 characters." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!(await consumeServerRateLimit(service, `team-accept:${getTrustedClientIp(request)}`, 10, 3600))) {
    return NextResponse.json({ error: "ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით. / Too many attempts. Try again later." }, { status: 429 });
  }

  const hash = hashInviteToken(parsed.data.token);
  const { data: invite } = await service.from("team_invites").select("id,email")
    .eq("token_hash", hash).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: INVALID }, { status: 404 });

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: invite.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json({
      error: exists
        ? "ამ ელ-ფოსტით ანგარიში უკვე არსებობს. სთხოვეთ სალონს სხვა ელ-ფოსტაზე მოწვევა. / An account with this email already exists. Ask the salon to invite another email."
        : "ანგარიში ვერ შეიქმნა. სცადეთ თავიდან. / The account could not be created. Please try again.",
    }, { status: exists ? 409 : 500 });
  }

  const { error: acceptError } = await service.rpc("accept_team_invite", { p_token_hash: hash, p_user_id: created.user.id });
  if (acceptError) {
    // Never leave a login without a salon: it would get an empty salon of its own on first sign-in.
    await service.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: INVALID }, { status: 409 });
  }

  return NextResponse.json({ email: invite.email });
}
