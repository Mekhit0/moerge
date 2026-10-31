import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { bookingLookupSchema } from "@/lib/validation";

const NOT_FOUND =
  "ჯავშანი ვერ მოიძებნა. შეამოწმეთ კოდი და ტელეფონის ნომერი. / Booking not found. Check the code and phone number.";

// Finds a booking by its 6-digit code plus the client's phone number and returns the private
// manage token. Both must match, and attempts are limited per visitor and per code so codes
// cannot be guessed.
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = bookingLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? NOT_FOUND }, { status: 400 });
  }

  let supabase;
  try { supabase = createServiceClient(); }
  catch { return NextResponse.json({ error: "Server configuration error." }, { status: 500 }); }

  try {
    const [ipAllowed, codeAllowed] = await Promise.all([
      consumeServerRateLimit(supabase, `booking-lookup:${getTrustedClientIp(request)}`, 10, 600),
      consumeServerRateLimit(supabase, `booking-lookup-code:${parsed.data.code}`, 5, 3600),
    ]);
    if (!ipAllowed || !codeAllowed) {
      return NextResponse.json({ error: "ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით. / Too many attempts. Please try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }

  const { data: token, error } = await supabase.rpc("find_booking_by_code", {
    p_code: parsed.data.code,
    p_phone: parsed.data.phone,
  });
  if (error) return NextResponse.json({ error: "Booking lookup is unavailable." }, { status: 500 });
  if (!token) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  return NextResponse.json({ token });
}
