import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { logAppError } from "@/lib/error-log";

const schema = z.discriminatedUnion("scope", [
  // The owner deletes the whole salon; typing the salon's name guards against a slip.
  z.object({ scope: z.literal("salon"), confirm: z.string().max(200) }),
  // Anyone else deletes only their own login.
  z.object({ scope: z.literal("me") }),
]);

/** DELETE: delete the salon (owner) or one's own login (admin, specialist). Cannot be undone. */
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const admin = createServiceClient();

  if (parsed.data.scope === "salon") {
    if (ctx.role !== "owner") return NextResponse.json({ error: "სალონს მხოლოდ მფლობელი შლის. / Only the owner can delete the salon." }, { status: 403 });
    if (parsed.data.confirm.trim() !== ctx.salonName.trim()) {
      return NextResponse.json({ error: "სალონის სახელი არ ემთხვევა. / The salon name does not match." }, { status: 400 });
    }
    const { data: orphans, error } = await admin.rpc("delete_salon", { p_salon_id: ctx.salonId, p_actor: ctx.user.id });
    if (error) {
      await logAppError({ source: "server", message: `Salon deletion failed: ${error.message}`, path: "/api/account", salonId: ctx.salonId, userId: ctx.user.id });
      return NextResponse.json({ error: "სალონი ვერ წაიშალა. სცადეთ თავიდან ან მოგვწერეთ. / The salon could not be deleted. Try again or write to us." }, { status: 500 });
    }
    // Logins that belonged only to this salon go too, the owner's included.
    const failed: string[] = [];
    for (const userId of (orphans ?? []) as string[]) {
      const { error: authError } = await admin.auth.admin.deleteUser(userId);
      if (authError) failed.push(userId);
    }
    if (failed.length) await logAppError({ source: "server", message: `${failed.length} logins left after salon deletion`, path: "/api/account" });
    await ctx.supabase.auth.signOut().catch(() => undefined);
    return NextResponse.json({ deleted: "salon" });
  }

  if (ctx.role === "owner") {
    return NextResponse.json({ error: "მფლობელი ჯერ სალონს შლის. / An owner deletes the salon instead." }, { status: 409 });
  }
  const { data: owned } = await admin.from("salon_memberships").select("id").eq("user_id", ctx.user.id).eq("role", "owner").eq("is_active", true).limit(1);
  if (owned?.length) return NextResponse.json({ error: "სხვა სალონის მფლობელი ხართ. ჯერ ის წაშალეთ. / You own another salon. Delete it first." }, { status: 409 });
  const { error } = await admin.auth.admin.deleteUser(ctx.user.id);
  if (error) {
    await logAppError({ source: "server", message: `Login deletion failed: ${error.message}`, path: "/api/account", userId: ctx.user.id });
    return NextResponse.json({ error: "ანგარიში ვერ წაიშალა. / The account could not be deleted." }, { status: 500 });
  }
  await ctx.supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ deleted: "me" });
}
