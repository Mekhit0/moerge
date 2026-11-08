import LegalView from "@/components/LegalView";
import { TERMS } from "@/lib/legal";

export default function TermsPage() {
  return <LegalView doc={TERMS} other={{ href: "/privacy", label: { ka: "კონფიდენციალურობის პოლიტიკა", en: "Privacy policy" } }} />;
}
