import { redirect } from "next/navigation";

// Message texts and history now live on the SMS page.
export default function Page() {
  redirect("/settings/sms");
}
