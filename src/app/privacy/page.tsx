import LegalView from "@/components/LegalView";
import { PRIVACY } from "@/lib/legal";

export default function PrivacyPolicyPage() {
  return <LegalView doc={PRIVACY} other={{ href: "/terms", label: { ka: "წესები და პირობები", en: "Terms of service" } }} />;
}
