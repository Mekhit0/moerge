import { NextRequest, NextResponse } from "next/server";
import { createAdminOrRpcSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailAddress } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(request: NextRequest): string {
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim().length > 0) {
    return xRealIp.trim();
  }

  // @ts-expect-error - Next.js Request.ip in Edge or standalone
  const reqIp = request.ip;
  if (reqIp && typeof reqIp === "string" && reqIp.trim().length > 0) {
    return reqIp.trim();
  }

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) {
      return first;
    }
  }

  return "127.0.0.1";
}

/**
 * POST /api/auth/register
 * Securely provisions a new salon owner account via Supabase Auth Admin.
 * Automatically confirms the email address on creation to eliminate SMTP delivery dependencies
 * and prevent "Error sending confirmation email" during onboarding.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Rate limit: max 10 registrations per hour per IP
    const rateLimitResult = checkRateLimit(
      `auth_register:${clientIp}`,
      10,
      60 * 60 * 1000
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error:
            "ძალიან ბევრი რეგისტრაციის მცდელობა. გთხოვთ სცადოთ მოგვიანებით. / Too many registration attempts from this IP. Please try again later.",
        },
        { status: 429 }
      );
    }

    let body: {
      email?: string;
      password?: string;
      fullName?: string;
      salonName?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "არასწორი მოთხოვნის ფორმატი / Invalid request format. JSON body required.",
        },
        { status: 400 }
      );
    }

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = (body.fullName || "").trim() || "Salon Owner";
    const salonName = (body.salonName || "").trim() || "My Beauty Salon";

    if (!isValidEmailAddress(email)) {
      return NextResponse.json(
        {
          error:
            "გთხოვთ მიუთითოთ სწორი ელ-ფოსტის მისამართი / Please provide a valid email address.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "პაროლი უნდა შედგებოდეს მინიმუმ 8 სიმბოლოსგან / Password must be at least 8 characters long.",
        },
        { status: 400 }
      );
    }

    const adminClient = createAdminOrRpcSupabaseClient();

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        salon_name: salonName,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("unique")
      ) {
        return NextResponse.json(
          {
            error:
              "მომხმარებელი ამ ელ-ფოსტით უკვე რეგისტრირებულია. გთხოვთ გაიაროთ ავტორიზაცია. / An account with this email already exists. Please sign in.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      message:
        "სალონის ანგარიში წარმატებით შეიქმნა / Salon account created successfully.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
