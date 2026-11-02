import { redirect } from "next/navigation";

// Client emails are switched off; sent messages are listed on the SMS page.
export default function EmailHistoryPage() {
  redirect("/settings/sms");
}
