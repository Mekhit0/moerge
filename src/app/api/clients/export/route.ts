import { NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

function csvCell(value: unknown): string {
  let text = value == null ? "" : Array.isArray(value) ? value.join("|") : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const clients: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await ctx.supabase.from("clients")
      .select("full_name,email,phone,notes,tags,created_at").eq("salon_id", ctx.salonId)
      .order("created_at", { ascending: true }).range(offset, offset + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    clients.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const headers = ["full_name", "email", "phone", "notes", "tags", "created_at"];
  const lines = [headers.map(csvCell).join(","), ...clients.map((client) => headers.map((key) => csvCell(client[key])).join(","))];
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moarge-clients-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
