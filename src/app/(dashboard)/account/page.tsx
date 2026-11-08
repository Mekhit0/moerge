import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import AccountManager from "@/components/AccountManager";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  return <AccountManager role={ctx.role} salonName={ctx.salonName} name={ctx.user.fullName} email={ctx.user.email} />;
}
