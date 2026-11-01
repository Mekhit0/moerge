import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";

const noteSchema = z.object({
  kind: z.enum(["note", "allergy", "formula"]),
  body: z.string().trim().min(1).max(2000),
});

const NOTE_FIELDS = "id,kind,body,created_at,created_by,author:user_profiles(full_name)";

type NoteRow = { author?: { full_name: string } | Array<{ full_name: string }> | null } & Record<string, unknown>;
function normalize(row: NoteRow) {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return { ...row, author: author?.full_name ?? null };
}

/**
 * Notes on a client card. Access follows the client: the office sees every client, a master only the
 * clients of their own visits (enforced by database policies). The author or the office can delete.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const { data, error } = await ctx.supabase.from("client_notes").select(NOTE_FIELDS)
    .eq("salon_id", ctx.salonId).eq("client_id", id).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Could not load notes." }, { status: 500 });
  return NextResponse.json({ notes: (data ?? []).map((row) => normalize(row as NoteRow)) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = noteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ჩაწერეთ შენიშვნა. / Write the note first." }, { status: 400 });
  }
  const { data, error } = await ctx.supabase.from("client_notes")
    .insert({ salon_id: ctx.salonId, client_id: id, kind: parsed.data.kind, body: parsed.data.body, created_by: ctx.user.id })
    .select(NOTE_FIELDS).single();
  if (error) return NextResponse.json({ error: "შენიშვნა ვერ შეინახა. / The note could not be saved." }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ note: normalize(data as NoteRow) }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const noteId = new URL(request.url).searchParams.get("note_id") ?? "";
  if (!z.string().uuid().safeParse(noteId).success) return NextResponse.json({ error: "Note id is required." }, { status: 400 });
  const { data, error } = await ctx.supabase.from("client_notes").delete()
    .eq("id", noteId).eq("client_id", id).eq("salon_id", ctx.salonId).select("id");
  if (error) return NextResponse.json({ error: "შენიშვნა ვერ წაიშალა. / The note could not be deleted." }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: "შეგიძლიათ მხოლოდ საკუთარი შენიშვნის წაშლა. / You can only delete your own notes." }, { status: 403 });
  return NextResponse.json({ success: true });
}
