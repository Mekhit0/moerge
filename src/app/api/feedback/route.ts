import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";

const schema = z.object({ body: z.string().trim().min(5).max(2000), pagePath: z.string().startsWith("/").max(300) });
export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write feedback from 5 to 2,000 characters." }, { status: 400 });
  try {
    const admin = createServiceClient();
    if (!(await consumeServerRateLimit(admin, `dashboard-feedback:${ctx.user.id}`, 5, 86400))) {
      return NextResponse.json({ error: "Feedback limit reached. Try again tomorrow." }, { status: 429 });
    }
  } catch { return NextResponse.json({ error: "Feedback is temporarily unavailable." }, { status: 503 }); }
  const { error } = await ctx.supabase.from("dashboard_feedback").insert({ salon_id: ctx.salonId, submitted_by: ctx.user.id, body: parsed.data.body, page_path: parsed.data.pagePath });
  if (error) return NextResponse.json({ error: "Feedback could not be saved." }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
