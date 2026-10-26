import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { z } from "zod";

const tokenSchema = z.object({
  token: z.string().uuid("Invalid unsubscribe token format."),
});

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid unsubscribe link token." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  try {
    if (!(await consumeServerRateLimit(supabase, `unsubscribe:${clientIp}`, 20, 60))) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }
  const { data, error } = await supabase.rpc("unsubscribe_client_by_token", {
    p_token: parsed.data.token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    success: boolean;
    error?: string;
    client_name?: string;
    salon_name?: string;
    canceled_reminders?: number;
  };

  if (!result?.success) {
    return NextResponse.json(
      { error: result?.error ?? "Invalid unsubscribe token." },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
