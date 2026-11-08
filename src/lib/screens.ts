/**
 * Real screenshots of moarge, taken from a demo salon with made-up clients (public/screens).
 * Retake them with a demo account whenever the screens they show change.
 */
import type { SeoScene } from "./seo-pages";

export interface ProductScreen {
  src: string;
  width: number;
  height: number;
  alt: { ka: string; en: string };
  caption: { ka: string; en: string };
}

const phone = { width: 780, height: 1688 };

export const SCREENS = {
  today: {
    src: "/screens/dashboard-mobile.jpg", ...phone,
    alt: { ka: "moarge-ის მთავარი ეკრანი ტელეფონზე: დღის ვიზიტები, გადახდილი თანხა და დღის განრიგი", en: "moarge home screen on a phone: today's visits, money paid and the day's schedule" },
    caption: { ka: "დღე ერთ ეკრანზე", en: "The day on one screen" },
  },
  calendar: {
    src: "/screens/calendar-mobile.jpg", ...phone,
    alt: { ka: "სალონის კალენდარი ტელეფონზე: სპეციალისტის ჯავშნები საათების მიხედვით", en: "Salon calendar on a phone: a specialist's bookings by the hour" },
    caption: { ka: "კალენდარი სპეციალისტებით", en: "Calendar by specialist" },
  },
  booking: {
    src: "/screens/booking-mobile.jpg", ...phone,
    alt: { ka: "სალონის ონლაინ ჯავშნის გვერდი: სერვისები ფასით და ხანგრძლივობით", en: "A salon's online booking page: services with price and length" },
    caption: { ka: "კლიენტის ჯავშნის გვერდი", en: "The client's booking page" },
  },
  clients: {
    src: "/screens/client-mobile.jpg", ...phone,
    alt: { ka: "კლიენტის ბარათი: ვიზიტები, დახარჯული თანხა, ბოლო ვიზიტი და შენიშვნები", en: "A client card: visits, money spent, last visit and notes" },
    caption: { ka: "კლიენტის ისტორია", en: "Client history" },
  },
  earnings: {
    src: "/screens/earnings-mobile.jpg", ...phone,
    alt: { ka: "შემოსავლის ეკრანი: გადახდილი თანხა, ვიზიტები, საშუალო ჩეკი, ნაღდი და ბარათი", en: "Earnings screen: money paid, visits, average ticket, cash and card" },
    caption: { ka: "შემოსავალი და თიფი", en: "Earnings and tips" },
  },
  calendarDesktop: {
    src: "/screens/calendar-desktop.jpg", width: 2560, height: 1600,
    alt: { ka: "moarge-ის კალენდარი კომპიუტერზე: სამი სპეციალისტის დღე გვერდიგვერდ", en: "moarge calendar on a computer: three specialists' day side by side" },
    caption: { ka: "მთელი გუნდის დღე კომპიუტერზე", en: "The whole team's day on a computer" },
  },
} satisfies Record<string, ProductScreen>;

/** The real screenshot that best shows each feature page's subject. */
export function screenForScene(scene: SeoScene): ProductScreen {
  switch (scene) {
    case "booking": return SCREENS.booking;
    case "calendar":
    case "team": return SCREENS.calendarDesktop;
    case "clients":
    case "visit": return SCREENS.clients;
    case "earnings": return SCREENS.earnings;
    case "reminder":
    case "today":
    default: return SCREENS.today;
  }
}
