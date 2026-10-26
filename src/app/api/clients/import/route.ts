import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { clientInputSchema, normalizeEmail } from "@/lib/validation";

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((line) => line.some((value) => value.trim()));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_000_000) return NextResponse.json({ error: "CSV is too large (2 MB maximum)." }, { status: 413 });
  let text: string;
  try { text = await request.text(); }
  catch { return NextResponse.json({ error: "Could not read CSV file." }, { status: 400 }); }
  if (new TextEncoder().encode(text).length > 2_000_000) return NextResponse.json({ error: "CSV is too large (2 MB maximum)." }, { status: 413 });
  let rows: string[][];
  try { rows = parseCsv(text); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid CSV." }, { status: 400 }); }
  if (rows.length < 2 || rows.length > 501) return NextResponse.json({ error: "CSV needs a header and between 1 and 500 client rows." }, { status: 400 });
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const fullNameIndex = headers.indexOf("full_name");
  const phoneIndex = headers.indexOf("phone");
  if (fullNameIndex < 0 || phoneIndex < 0) return NextResponse.json({ error: "CSV must include full_name and phone columns." }, { status: 400 });
  const value = (row: string[], key: string) => row[headers.indexOf(key)] ?? "";
  const normalized = rows.slice(1).map((row, index) => {
    const parsed = clientInputSchema.safeParse({
      full_name: row[fullNameIndex], email: value(row, "email"), phone: row[phoneIndex],
      notes: value(row, "notes"), email_consent: false, sms_consent: false, preferred_language: value(row, "preferred_language") || "ka",
    });
    return { parsed, line: index + 2 };
  });
  const invalid = normalized.filter((item) => !item.parsed.success);
  if (invalid.length) return NextResponse.json({
    error: "Some rows are invalid. Fix them and upload again.",
    invalid_rows: invalid.slice(0, 20).map(({ parsed, line }) => ({ line, issue: parsed.success ? "" : parsed.error.issues[0]?.message })),
  }, { status: 422 });
  const payload = normalized.map(({ parsed }, index) => {
    if (!parsed.success) return null;
    const source = rows[index + 1];
    return {
      full_name: parsed.data.full_name,
      email: parsed.data.email ? normalizeEmail(parsed.data.email) : null,
      phone: parsed.data.phone,
      notes: parsed.data.notes ?? null,
      tags: value(source, "tags").split("|").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
    };
  }).filter(Boolean);
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("import_salon_clients", { p_salon_id: ctx.salonId, p_rows: payload });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: Number(data ?? 0), skipped_duplicates: payload.length - Number(data ?? 0) });
}
