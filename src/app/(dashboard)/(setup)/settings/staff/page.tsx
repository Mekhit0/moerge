import BookingSettingsManager from "@/components/BookingSettingsManager";
import TeamAccess from "@/components/team/TeamAccess";

export default function Page() {
  return <>
    <BookingSettingsManager section="staff" />
    <TeamAccess />
  </>;
}
