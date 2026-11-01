import "server-only";
import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "./supabase/server";

/**
 * The platform owner (you) is the only person who sees the admin panel. The account id comes from
 * PLATFORM_OWNER_USER_ID; without it the panel stays off. Returns a service client for cross-salon
 * reads, or a response to send back.
 */
export async function requirePlatformOwner(): Promise<{ db: ReturnType<typeof createServiceClient> } | { response: NextResponse }> {
  const ownerId = process.env.PLATFORM_OWNER_USER_ID?.trim();
  if (!ownerId) return { response: NextResponse.json({ error: "Platform owner is not configured." }, { status: 503 }) };
  const session = await createServerSupabaseClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user || user.id !== ownerId) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { db: createServiceClient() };
}
